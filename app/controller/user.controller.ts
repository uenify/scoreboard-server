import bcrypt from 'bcrypt-nodejs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import validator from 'validator'
import { IUser, IUserRegisterData, User } from '../model/user.model'
import { secret } from '../secret'

const baseURL = 'http://localhost:8080'
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'scoreboard.noreply@gmail.com',
    pass: secret.mail,
  },
})
function generateHash(password: string): string {
  const hash = bcrypt.hashSync(password)
  return hash
}

function checkHash(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash)
}

function generateToken(payload: object): string {
  const token = jwt.sign({ data: payload }, secret.jwt, {
    algorithm: 'HS512',
    expiresIn: 60 * 60 * 24,
  })
  return token
}

export async function register(data: IUserRegisterData) {
  if (data.role !== 'Jury' && data.role !== 'Competitor') {
    throw { status: 400, message: `Cannot register user ${data.email} with role ${data.role}` }
  }
  if (data.password == null || data.email == null || data.name == null || data.name.first == null) {
    throw { status: 400, message: `Cannot register user ${data.email}, malformed request` }
  }
  if (data.password.length < 8) {
    throw { status: 400, message: `Cannot register user ${data.email}, password is too short` }
  }
  if (!validator.isEmail(data.email)) {
    throw { status: 400, message: `Cannot register user ${data.email}, malformed email` }
  }
  const ifUserWasRegisteredBefore = await User.findOne({ email: data.email })
  if (ifUserWasRegisteredBefore != null) {
    throw { status: 400, message: `Cannot register user ${data.email}, user already exists` }
  }
  const hash = generateHash(data.password)

  const token = generateToken({ email: data.email, name: data.name, role: data.role, verified: false })
  let user = await User.create({
    email: data.email,
    name: data.name,
    role: data.role,
    hash,
    blocked: false,
    verified: false,
    verificationURL: `${baseURL}/account/verify/${data.email}/${crypto.randomBytes(32).toString('hex')}`,
    token,
  })

  user = await user.save()

  await sendVerificationMail(data.email, token)
  return { token }
}

export async function login(email: string, password: string) {
  let user = await User.findOne({ email })
  if (!user) {
    throw { status: 400, message: `Incorrent email or password` }
  }

  const hash = user.hash

  if (checkHash(password, hash)) {
    const token = generateToken({ email: user.email, name: user.name, role: user.role, verified: user.verified })
    user.token = token
    user = await user.save()
    return { token, verified: user.verified }
  } else {
    throw { status: 400, message: `Incorrent email or password` }
  }
}

export async function checkToken(email: string, token: string) {
  const user = await User.findOne({ email })
  if (!user) {
    throw { status: 400, message: `Incorrent email or password` }
  }

  return user.token === token
}

export async function sendVerificationMail(email: string, token: string) {
  const user = await User.findOne({ email })
  if (!user) {
    throw { status: 400, message: `Incorrent email or password` }
  }
  if (!checkToken(email, token)) {
    throw { status: 400, message: `Incorrent email or password` }
  }
  if (user.verified) {
    throw { status: 400, message: `This E-Mail address is already verified` }
  }

  await transporter.sendMail({
    from: 'scoreboard.noreply@gmail.com',
    to: user.email,
    subject: 'Verify your account on Scoreboard',
    html: `
      <h2>Hey! Welcome to Scoreboard!</h2>
      <p>Before starting, you need to verify your email address. Please, do so by clicking link below.</p>
      <a href="${user.verificationURL}">Here!</a>
    `,
  })
}

export async function verifyEmail(email: string, bytes: string) {
  const user = await User.findOne({ email })
  if (!user) {
    throw { status: 400, message: `Incorrent email or password` }
  }
  const uri: string[] = user.verificationURL.split('/')
  if (uri[uri.length - 1] === bytes) {
    user.verified = true
    await user.save()
    return { verified: true }
  }
  throw { status: 400, message: 'Incorrect bytes' }
}
