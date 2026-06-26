import { createRoot } from "react-dom/client";
import "./options.css";
import { Options } from "./Options";

const root = document.getElementById("root");
if (root) createRoot(root).render(<Options />);
