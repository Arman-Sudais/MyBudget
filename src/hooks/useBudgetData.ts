import { useBudgetContext } from '../cloud/context'

export { STORAGE_KEY } from './useLocalBudgetData'
export function useBudgetData() {
  return useBudgetContext()
}
