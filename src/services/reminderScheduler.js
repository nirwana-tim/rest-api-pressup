const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_TIMEZONE = 'Asia/Jakarta'
const MORNING_REMINDER_HOUR = 7

export function isValidTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return false

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function getZonedParts(date, timeZone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  return formatter.formatToParts(date).reduce((parts, part) => {
    if (part.type !== 'literal') {
      parts[part.type] = Number(part.value)
    }
    return parts
  }, {})
}

function getTimeZoneOffsetMs(date, timeZone = DEFAULT_TIMEZONE) {
  const parts = getZonedParts(date, timeZone)
  const utcLikeTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )

  return utcLikeTime - date.getTime()
}

function zonedDateTimeToUtcDate({
  year,
  month,
  day,
  hour = MORNING_REMINDER_HOUR,
  minute = 0,
  second = 0,
  timeZone = DEFAULT_TIMEZONE,
}) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone)
  const firstPass = new Date(utcGuess.getTime() - offset)
  const correctedOffset = getTimeZoneOffsetMs(firstPass, timeZone)

  return new Date(utcGuess.getTime() - correctedOffset)
}

function morningInPresentationZone(date, timeZone = DEFAULT_TIMEZONE) {
  const parts = getZonedParts(date, timeZone)

  return zonedDateTimeToUtcDate({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: MORNING_REMINDER_HOUR,
    minute: 0,
    second: 0,
    timeZone,
  })
}

function addMonthsInZone(date, months, timeZone = DEFAULT_TIMEZONE) {
  const parts = getZonedParts(date, timeZone)
  const target = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1))
  const targetParts = getZonedParts(target, 'UTC')
  const lastDay = new Date(
    Date.UTC(targetParts.year, targetParts.month, 0),
  ).getUTCDate()

  return zonedDateTimeToUtcDate({
    year: targetParts.year,
    month: targetParts.month,
    day: Math.min(parts.day, lastDay),
    hour: MORNING_REMINDER_HOUR,
    timeZone,
  })
}

function addReminder(reminders, date, type, now, presentationDate) {
  if (date <= now || date >= presentationDate) return

  reminders.push({
    reminder_at: date.toISOString(),
    reminder_type: type,
  })
}

function addCatchUpReminder(reminders, type, now, presentationDate) {
  const reminderAt = new Date(now.getTime() + 5 * 60 * 1000)
  addReminder(reminders, reminderAt, type, now, presentationDate)
}

function dedupeReminders(reminders) {
  const seen = new Set()

  return reminders
    .sort((a, b) => new Date(a.reminder_at) - new Date(b.reminder_at))
    .filter((reminder) => {
      const key = `${reminder.reminder_at}:${reminder.reminder_type}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function buildScheduleReminders({
  scheduleId,
  userId,
  presentationDate,
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
}) {
  if (!isValidTimeZone(timezone)) {
    throw new Error('Timezone tidak valid')
  }

  const presentationAt = new Date(presentationDate)
  const diffMs = presentationAt.getTime() - now.getTime()

  if (!scheduleId || !userId || Number.isNaN(presentationAt.getTime()) || diffMs <= 0) {
    return []
  }

  const reminders = []
  const diffDays = diffMs / DAY_MS

  if (diffDays >= 30) {
    let monthsBefore = 1

    while (monthsBefore <= 60) {
      const reminderDate = addMonthsInZone(
        presentationAt,
        -monthsBefore,
        timezone,
      )

      if (reminderDate <= now) break

      addReminder(reminders, reminderDate, 'monthly', now, presentationAt)
      monthsBefore += 1
    }
  }

  if (diffDays >= 7) {
    ;[28, 21, 14, 7].forEach((daysBefore) => {
      const reminderDate = morningInPresentationZone(
        new Date(presentationAt.getTime() - daysBefore * DAY_MS),
        timezone,
      )
      addReminder(reminders, reminderDate, 'weekly', now, presentationAt)
    })
  }

  const threeDaysBefore = morningInPresentationZone(
    new Date(presentationAt.getTime() - 3 * DAY_MS),
    timezone,
  )
  addReminder(reminders, threeDaysBefore, 'three_days_before', now, presentationAt)

  const sameDayMorning = morningInPresentationZone(presentationAt, timezone)
  if (sameDayMorning > now) {
    addReminder(reminders, sameDayMorning, 'same_day_morning', now, presentationAt)
  } else if (diffDays < 1) {
    addCatchUpReminder(reminders, 'same_day_morning', now, presentationAt)
  }

  if (diffDays < 3 && diffDays >= 1 && threeDaysBefore <= now) {
    addCatchUpReminder(reminders, 'three_days_before', now, presentationAt)
  }

  return dedupeReminders(reminders).map((reminder) => ({
    schedule_id: scheduleId,
    user_id: userId,
    channel: 'email',
    status: 'pending',
    ...reminder,
  }))
}

export function getReminderSubject(reminderType) {
  const subjects = {
    monthly: 'Waktunya latihan presentasi bulan ini',
    weekly: 'Reminder latihan presentasi minggu ini',
    three_days_before: 'H-3 presentasi: latihan final yuk',
    same_day_morning: 'Hari ini presentasi: pemanasan dulu yuk',
  }

  return subjects[reminderType] ?? 'Reminder latihan presentasi'
}

export function getReminderMessage(reminderType) {
  const messages = {
    monthly:
      'Jadwal presentasimu masih cukup jauh, tapi latihan rutin dari sekarang akan bikin kamu lebih siap.',
    weekly:
      'Presentasimu makin dekat. Luangkan satu sesi latihan untuk memperkuat alur, tempo, dan artikulasi.',
    three_days_before:
      'Tiga hari lagi presentasi. Ini waktu yang pas untuk latihan final dan cek bagian yang masih kurang lancar.',
    same_day_morning:
      'Hari ini kamu presentasi. Ambil beberapa menit untuk pemanasan suara dan latihan singkat sebelum tampil.',
  }

  return messages[reminderType] ?? messages.weekly
}
