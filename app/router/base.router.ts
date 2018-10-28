import { Request, Response, Router } from 'express'
import jwt from 'express-jwt'
import _ from 'lodash'
import { error, log } from '../logger'
import { secret } from '../secret'

export enum RequestMethod {
  GET,
  POST,
  PUT,
  DELETE,
}
export interface IUserPayload {
  email: string,
  name: {
    first: string,
    middle?: string,
    last?: string,
  },
  role: string,
  verified: boolean,
}
export interface IRequest {
  method: RequestMethod,
  path: string,
  authRequired: boolean,
  verification: {
    body: string[],
    user: (user: IUserPayload) => Promise<boolean>,
    beforeAction: (body: any, user: IUserPayload) => Promise<boolean>,
  },
  action: (body: any, user: IUserPayload) => Promise<any>,
}

export function checkBody(body: any, params: string[]): boolean {
  for (const param of params) {
    if (!_.has(body, param)) {
      return false
    }
  }
  return true
}
export function createRouter(requests: IRequest[]): Router {
  const router = Router()
  requests.forEach((request) => {
    const handlers = [
      jwt({ secret: secret.jwt, credentialsRequired: request.authRequired }),
      (req: Request, res: Response, next: any) => {
        const body = (request.method === RequestMethod.GET) ? req.query : req.body
        const bodyValid = checkBody(body, request.verification.body)
        if (!bodyValid) {
          throw { code: 400, message: 'Malformed request body' }
        }
        next()
      },
      async (req: Request, res: Response, next: any) => {
        try {
          if (request.authRequired) {
            if (req.user === null) {
              throw { code: 403, message: 'Authentication is required' }
            }
            if (!req.user.data.verified) {
              throw { code: 400, message: 'User is not verified' }
            }
            const userValid = await request.verification.user(req.user.data)
            if (!userValid) {
              throw { code: 400, message: 'Invalid user passed' }
            }
          }
          next()
        } catch (e) {
          next(e)
        }
      },
      async (req: Request, res: Response, next: any) => {
        try {
          const body = (request.method === RequestMethod.GET) ? req.query : req.body
          const valid = await request.verification.beforeAction(body, (req.user) ? req.user.data : null)
          if (!valid) {
            throw { status: 400, message: 'Invalid request, access denied' }
          }
          next()
        } catch (e) {
          next(e)
        }
      },
      async (req: Request, res: Response, next: any) => {
        try {
        const body = (request.method === RequestMethod.GET) ? req.query : req.body
        const actionResponse = await request.action(body, (req.user) ? req.user.data : null)
        log(actionResponse)
        res.status(200).send(actionResponse)
        } catch (e) {
          next(e)
        }
      },
    ]

    if (request.method === RequestMethod.GET) {
      router.get(request.path, handlers)
    } else if (request.method === RequestMethod.POST) {
      router.post(request.path, handlers)
    } else if (request.method === RequestMethod.PUT) {
      router.put(request.path, handlers)
    } else if (request.method === RequestMethod.DELETE) {
      router.delete(request.path, handlers)
    }
  })

  router.use((err: any, req: Request, res: Response, next: () => any) => {
    error(err.message)
    res.status(400).send(err)
  })
  return router
}
