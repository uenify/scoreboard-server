import { ObjectId } from 'bson'
import { Competition, ICompetition, ICompetitionBasic, IRound } from '../model/competition.model'
import { IUserPayload } from '../router/base.router'

export async function create(data: ICompetition, user: IUserPayload): Promise<ICompetition> {
  if (data.rounds.length === 0) {
    throw { status: 400, message: 'You must have at least one round in your competition' }
  }
  let prevEnd: Date = new Date(0)
  for (const round of data.rounds) {
    const start = new Date(round.start)
    const end = new Date(round.end)
    if (start.getTime() > end.getTime()) {
      throw { status: 400, message: 'Round cannot start before it has ended' }
    } else if (prevEnd && start.getTime() < prevEnd.getTime()) {
      throw { status: 400, message: 'Round cannot start before previous round finishes' }
    } else {
      prevEnd = end
    }
  }
  const set = {
    name: data.name,
    description: data.description,
    location: data.location,
    rounds: data.rounds,
    creator: {email: user.email, name: user.name},
    juries: [{email: user.email, name: user.name}],
  }
  let competition = new Competition(set)
  competition = await competition.save()
  return {
    _id: competition._id,
    name: competition.name,
    description: competition.description,
    location: competition.location,
    rounds: competition.rounds,
  } as ICompetition
}

export async function get(id: ObjectId): Promise<ICompetition> {
  const competition = await Competition.findById(id)
  if (!competition) {
    throw { status: 404, message: `Competition with id ${id} was not found` }
  }
  return {
    _id: competition._id,
    name: competition.name,
    description: competition.description,
    location: competition.location,
    creator: competition.creator,
    rounds: competition.rounds,
  } as ICompetition
}

export async function getRaw(id: ObjectId): Promise<ICompetition> {
  const competition = await Competition.findById(id)
  if (!competition) {
    throw { status: 404, message: `Competition with id ${id} was not found` }
  }
  return competition
}

export async function getDetailed(id: ObjectId, user: IUserPayload): Promise<ICompetition> {
  const competition = await Competition.findById(id)
  if (!competition) {
    throw { status: 404, message: `Competition with id ${id} was not found` }
  }
  return {
    _id: competition._id,
    name: competition.name,
    description: competition.description,
    location: competition.location,
    rounds: competition.rounds,
    creator: competition.creator,
    juries: competition.juries,
  } as ICompetition
}

export async function getAll(): Promise<ICompetitionBasic[]> {
  const competitions = await Competition.find({}, { tasks: 0, juries: 0, creator: 0 })
  const competitionsToReturn = competitions.map<ICompetitionBasic>((competition: ICompetition) => {
    return {
      _id: competition._id,
      name: competition.name,
      description: competition.description,
      location: competition.location,
      start: competition.rounds[0].start,
      end: competition.rounds[competition.rounds.length - 1].end,
    }
  })
  return competitionsToReturn
}

export async function update(data: ICompetition): Promise<ICompetition> {
  let competition = await Competition.findById(data._id)
  if (!competition) {
    throw { status: 404, message: `Competition with id ${data._id} was not found` }
  }
  competition.name = data.name || competition.name
  competition.description = data.description || competition.description
  competition.location = data.location || competition.location
  competition.rounds = data.rounds || competition.rounds
  competition = await competition.save()
  return {
    _id: competition._id,
    name: competition.name,
    description: competition.description,
    location: competition.location,
    rounds: competition.rounds,
  } as ICompetition
}

export async function remove(id: ObjectId): Promise<ICompetition> {
  const competition = await Competition.findByIdAndRemove(id)
  if (!competition) {
    throw { status: 404, message: `Competition with id ${id} was not found` }
  }
  return {
    _id: competition._id,
    name: competition.name,
    description: competition.description,
    location: competition.location,
    rounds: competition.rounds,
  } as ICompetition
}
