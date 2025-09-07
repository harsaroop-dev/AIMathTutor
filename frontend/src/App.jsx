import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
// import './App.css'
import LogIn from "./components/LogIn";
import Home from "./components/Home";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <div className="loginContainer m-0 p-0">
        <Home />
      </div>
    </>
  );
}

export default App;
