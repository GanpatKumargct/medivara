import { Navigate, createBrowserRouter } from 'react-router-dom'
import { RequireAuth, RootRedirect } from './components/guards'
import { PatientLayout } from './components/layout'
import { EvidenceRouteProvider } from './components/evidence-route'
import { NotFoundPage } from './components/states'
import Login from './screens/Login'
import Signup from './screens/Signup'
import Invite from './screens/Invite'
import Onboarding from './screens/Onboarding'
import ProfileSelector from './screens/ProfileSelector'
import Chat from './screens/Chat'
import Dashboard from './screens/Dashboard'
import Records from './screens/Records'
import DocumentReview from './screens/DocumentReview'
import Timeline from './screens/Timeline'
import Brief from './screens/Brief'
import VisitAssist from './screens/VisitAssist'
import Reminders from './screens/Reminders'
import Family from './screens/Family'
import Settings from './screens/Settings'
import Vitals from './screens/Vitals'
import Medicines from './screens/Medicines'
import MedicalId from './screens/MedicalId'
import Services from './screens/Services'
import WomensHealth from './screens/WomensHealth'

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <Signup /> },
  // Works signed in or out: the page asks the invitee to sign in or create an account.
  { path: '/invite/:invitationId', element: <Invite /> },
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
      { index: true, element: <Chat /> },
      { path: 'chat/:chatId', element: <Chat /> },
      { path: 'ask', element: <Navigate to=".." relative="path" replace /> },
      { path: 'overview', element: <Dashboard /> },
      { path: 'records', element: <Records /> },
      { path: 'records/:documentId', element: <DocumentReview /> },
      { path: 'timeline', element: <Timeline /> },
      { path: 'vitals', element: <Vitals /> },
      { path: 'medicines', element: <Medicines /> },
      { path: 'brief', element: <Brief /> },
      { path: 'visit-assist', element: <VisitAssist /> },
      { path: 'reminders', element: <Reminders /> },
      { path: 'medical-id', element: <MedicalId /> },
      { path: 'family', element: <Family /> },
      { path: 'services', element: <Services /> },
      { path: 'womens-health', element: <WomensHealth /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
