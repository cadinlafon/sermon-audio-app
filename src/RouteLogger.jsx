import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { logEvent } from "./utils/logEvent";

export default function RouteLogger() {

const location = useLocation();

useEffect(() => {

logEvent("page_visit", {
path: location.pathname
});

}, [location]);

return null;

}