import { createBrowserRouter } from 'react-router-dom'
import { RequireAuth, RootRedirect } from './components/guards'
import { PatientLayout } from './components/layout'
import { EvidenceRouteProvider } from './components/evidence-route'
import { NotFoundPage } from './components/states'
import Login from './screens/Login'
import Onboarding from './screens/Onboarding'
import ProfileSelector from './screens/ProfileSelector'
import Dashboard from './screens/Dashboard'
import Records from './screens/Records'
import DocumentReview from './screens/DocumentReview'
import Timeline from './screens/Timeline'
import Ask from './screens/Ask'
import Brief from './screens/Brief'
import VisitAssist from './screens/VisitAssist'
import Reminders from './screens/Reminders'
import Family from './screens/Family'
import Settings from './screens/Settings'

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <Login /> },
  {
    path: '/onboarding',
    element: (
      <RequireAuth>
        <Onboarding />
      </RequireAuth>
    ),
  },
  {
    path: '/profiles',
    element: (
      <RequireAuth>
        <ProfileSelector />
      </RequireAuth>
    ),
  },
  {
    path: '/p/:patientId',
    element: (
      <RequireAuth>
        <EvidenceRouteProvider>
          <PatientLayout />
        </EvidenceRouteProvider>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'records', element: <Records /> },
      { path: 'records/:documentId', element: <DocumentReview /> },
      { path: 'timeline', element: <Timeline /> },
      { path: 'ask', element: <Ask /> },
      { path: 'brief', element: <Brief /> },
      { path: 'visit-assist', element: <VisitAssist /> },
      { path: 'reminders', element: <Reminders /> },
      { path: 'family', element: <Family /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
