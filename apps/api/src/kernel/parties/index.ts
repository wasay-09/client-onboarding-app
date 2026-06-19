// Public surface of the parties kernel slice. The projection is invoked by the cases
// slice inside its create transaction; staff reads parties via the staff slice.
export { projectParties, buildParties } from './projection'
