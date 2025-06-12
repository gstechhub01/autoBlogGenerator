import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/entension-accelerate'

const prisma = new PrismaClient().$extends(withAccelerate());