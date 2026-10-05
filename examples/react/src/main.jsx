import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.jsx";
import "./styles.css";

// StrictMode monta, desmonta e monta de novo cada efeito em desenvolvimento: o exemplo
// garante que montar e destruir a biblioteca é idempotente.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
