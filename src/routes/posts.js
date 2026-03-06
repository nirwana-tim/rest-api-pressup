import { Router } from 'express'
import { getPosts, createPost, updatePost, deletePost } from '../controllers/postController.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate) // semua route posts butuh JWT

router.get('/', getPosts)
router.post('/', createPost)
router.put('/:id', updatePost)
router.delete('/:id', deletePost)

export default router