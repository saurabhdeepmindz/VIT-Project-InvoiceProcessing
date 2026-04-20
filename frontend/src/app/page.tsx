/**
 * Root page — Phase 0 demo landing. Redirects to /login.
 * Phase 2 will wire /dashboard, /upload, /tracker, /reports routes.
 */

import { redirect } from 'next/navigation';

export default function HomePage(): never {
  redirect('/login');
}
