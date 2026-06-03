import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { RequireAuth } from './components/RequireAuth';
import { SemanaAtualRedirect } from './pages/Semana/SemanaAtualRedirect';
import { SemanaDetalhe } from './pages/Semana/SemanaDetalhe';
import { SemanaCardapio } from './pages/Semana/SemanaCardapio';
import { Financeiro } from './pages/Financeiro/Financeiro';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<Navigate to="/semanas/atual" replace />} />
        <Route path="/semanas" element={<Navigate to="/semanas/atual" replace />} />
        <Route
          path="/semanas/atual"
          element={
            <RequireAuth>
              <SemanaAtualRedirect />
            </RequireAuth>
          }
        />
        <Route
          path="/semanas/:id"
          element={
            <RequireAuth>
              <SemanaDetalhe />
            </RequireAuth>
          }
        />
        <Route
          path="/semanas/:id/cardapio"
          element={
            <RequireAuth>
              <SemanaCardapio />
            </RequireAuth>
          }
        />
        <Route
          path="/financeiro"
          element={
            <RequireAuth>
              <Financeiro />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
