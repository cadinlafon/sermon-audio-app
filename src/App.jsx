import { Routes, Route } from "react-router-dom";

// Pages
import Home from "./pages/Home";
import Sermons from "./pages/Sermons";
import Homilys from "./pages/Homilys";
import SundaySchool from "./pages/SundaySchool";
import Feedback from "./pages/Feedback";
import Settings from "./pages/Settings";
import About from "./pages/About";
import Admin from "./pages/Admin";

// Components
import Navbar from "./components/Navbar";

function App() {
  return (
    <>
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sermons" element={<Sermons />} />
        <Route path="/homilys" element={<Homilys />} />
        <Route path="/sundayschool" element={<SundaySchool />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/about" element={<About />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </>
  );
}

export default App;