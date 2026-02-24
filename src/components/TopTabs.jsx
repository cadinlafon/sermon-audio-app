import { NavLink } from "react-router-dom";

function TopTabs() {
  return (
    <nav className="top-tabs">
      <NavLink to="/" end>Home</NavLink>
      <NavLink to="/sermons">Sermons</NavLink>
      <NavLink to="/sunday-school">Sunday School</NavLink>
      <button className="more-btn">More</button>
    </nav>
  );
}

export default TopTabs;
