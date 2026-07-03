import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Applications from './pages/Applications';
import NewApplication from './pages/NewApplication';
import ApplicationDetail from './pages/ApplicationDetail';
import CreditScoring from './pages/CreditScoring';
import LoanAccounts from './pages/LoanAccounts';
import EMICalculator from './pages/EMICalculator';
import Collections from './pages/Collections';
import Reports from './pages/Reports';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/leads" element={
            <ProtectedRoute roles={['Admin','Loan Officer']}>
              <Layout><Leads /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/applications" element={
            <ProtectedRoute roles={['Admin','Loan Officer','Credit Analyst']}>
              <Layout><Applications /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/applications/new" element={
            <ProtectedRoute roles={['Admin','Loan Officer']}>
              <Layout><NewApplication /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/applications/:id" element={
            <ProtectedRoute roles={['Admin','Loan Officer','Credit Analyst']}>
              <Layout><ApplicationDetail /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/credit-scoring" element={
            <ProtectedRoute roles={['Admin','Credit Analyst']}>
              <Layout><CreditScoring /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/loan-accounts" element={
            <ProtectedRoute roles={['Admin','Loan Officer']}>
              <Layout><LoanAccounts /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/emi-calculator" element={
            <ProtectedRoute>
              <Layout><EMICalculator /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/collections" element={
            <ProtectedRoute roles={['Admin','Collections Agent']}>
              <Layout><Collections /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute roles={['Admin']}>
              <Layout><Reports /></Layout>
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
