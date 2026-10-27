import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BudgetProvider, useBudgetContext } from './cloud/context'
import { CloudWorkspace } from './components/Cloud'
import './index.css'

function Workspace() {
  const { cloud } = useBudgetContext()
  return (
    <CloudWorkspace>
      <App key={cloud.viewKey} />
    </CloudWorkspace>
  )
}
const root = import.meta.hot?.data.root ?? ReactDOM.createRoot(document.getElementById('root')!)
if (import.meta.hot)
  import.meta.hot.dispose((data) => {
    data.root = root
  })
root.render(
  <React.StrictMode>
    <BudgetProvider>
      <Workspace />
    </BudgetProvider>
  </React.StrictMode>,
)
