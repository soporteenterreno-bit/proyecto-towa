/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationProvider } from './context/NotificationContext';
import Login from './pages/Login';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Cuenta from './pages/Cuenta';

// Real Components
import Dashboard from './pages/Dashboard';
import Tiendas from './pages/Tiendas';
import Inventario from './pages/Inventario';
import Personal from './pages/Personal';
import AsignarVisita from './pages/AsignarVisita';
import MisVisitas from './pages/MisVisitas';
import TablaVisitas from './pages/TablaVisitas';
import FormularioVisita from './pages/FormularioVisita';

import Configuracion from './pages/Configuracion';

export default function App() {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <AuthProvider>
          <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="cuenta" element={<Cuenta />} />
              
              <Route path="tiendas" element={<Tiendas />} />
              <Route path="tiendas/:tiendaId/inventario" element={<Inventario />} />
              
              <Route 
                path="visitas/mis-visitas" 
                element={
                  <ProtectedRoute allowedRoles={['administrador', 'tecnico']}>
                    <MisVisitas />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="visitas/tabla" 
                element={
                  <ProtectedRoute allowedRoles={['administrador', 'tecnico']}>
                    <TablaVisitas />
                  </ProtectedRoute>
                } 
              />
              
              <Route
                path="visitas/asignar"
                element={
                  <ProtectedRoute allowedRoles={['administrador', 'tecnico']}>
                    <AsignarVisita />
                  </ProtectedRoute>
                }
              />

              <Route path="visitas/ejecutar/:visitaId" element={<FormularioVisita />} />
              
              <Route 
                path="admin-preguntas" 
                element={
                  <ProtectedRoute allowedRoles={['administrador']}>
                    <></>
                  </ProtectedRoute>
                } 
              />
              <Route path="configuracion" element={
                <ProtectedRoute allowedRoles={['administrador']}>
                  <Configuracion />
                </ProtectedRoute>
              } />
              
              <Route 
                path="personal/*" 
                element={
                  <ProtectedRoute allowedRoles={['administrador']}>
                    <Personal />
                  </ProtectedRoute>
                } 
              />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
      </NotificationProvider>
    </ErrorBoundary>
  );
}

