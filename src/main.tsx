import {createRoot, hydrateRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

const container = document.getElementById('root')!;
const app = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

// Prerendered pages ship with server HTML; hydrate them so the markup is reused.
if (container.hasChildNodes()) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
