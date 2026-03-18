import { useState } from "react";

export default function Privacy() {

const [analytics, setAnalytics] = useState(false);

return (

<div>

<h2>Privacy</h2>

<label>
<input
type="checkbox"
checked={analytics}
onChange={() => setAnalytics(!analytics)}
/>
 Allow anonymous analytics
</label>

</div>

);

}