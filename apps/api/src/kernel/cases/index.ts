// Public surface of the cases kernel slice — nothing else here is importable.
export { CaseService, ValidationError, createCaseSchema, type CreateCaseRequest } from './service'
export { CaseStore } from './store'
export { registerCaseRoutes } from './routes'
