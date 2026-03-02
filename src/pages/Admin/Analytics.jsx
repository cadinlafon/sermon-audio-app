import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Analytics() {
  const [usesByDay, setUsesByDay] = useState([]);
  const [usesByMonth, setUsesByMonth] = useState([]);
  const [newUsersByMonth, setNewUsersByMonth] = useState([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // 🔥 GET APP USAGE
        const usageSnap = await getDocs(collection(db, "appUsage"));
        const usageData = usageSnap.docs.map(doc => doc.data());

        // 🔥 GET USERS
        const usersSnap = await getDocs(collection(db, "users"));
        const usersData = usersSnap.docs.map(doc => doc.data());

        // ------------------------
        // USES BY DAY
        // ------------------------
        const dayCounts = {};

        usageData.forEach(item => {
          if (!item.createdAt?.seconds) return;

          const date = new Date(item.createdAt.seconds * 1000);
          const day = date.toLocaleDateString();

          dayCounts[day] = (dayCounts[day] || 0) + 1;
        });

        const dayChartData = Object.keys(dayCounts).map(day => ({
          name: day,
          value: dayCounts[day],
        }));

        setUsesByDay(dayChartData);

        // ------------------------
        // USES BY MONTH
        // ------------------------
        const monthCounts = {};

        usageData.forEach(item => {
          if (!item.createdAt?.seconds) return;

          const date = new Date(item.createdAt.seconds * 1000);
          const month = `${date.getMonth() + 1}/${date.getFullYear()}`;

          monthCounts[month] = (monthCounts[month] || 0) + 1;
        });

        const monthChartData = Object.keys(monthCounts).map(month => ({
          name: month,
          value: monthCounts[month],
        }));

        setUsesByMonth(monthChartData);

        // ------------------------
        // NEW USERS PER MONTH
        // ------------------------
        const userMonthCounts = {};

        usersData.forEach(user => {
          if (!user.createdAt?.seconds) return;

          const date = new Date(user.createdAt.seconds * 1000);
          const month = `${date.getMonth() + 1}/${date.getFullYear()}`;

          userMonthCounts[month] = (userMonthCounts[month] || 0) + 1;
        });

        const userChartData = Object.keys(userMonthCounts).map(month => ({
          name: month,
          value: userMonthCounts[month],
        }));

        setNewUsersByMonth(userChartData);

      } catch (error) {
        console.error("Analytics error:", error);
      }
    };

    fetchAnalytics();
  }, []);

  return (
    <div style={{ padding: "30px" }}>
      <h1 style={{ marginBottom: "40px" }}>Analytics Dashboard</h1>

      {/* USES BY DAY */}
      <div style={{ height: "300px", marginBottom: "60px" }}>
        <h2>Uses by Day</h2>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={usesByDay}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* USES BY MONTH */}
      <div style={{ height: "300px", marginBottom: "60px" }}>
        <h2>Uses by Month</h2>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={usesByMonth}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* NEW USERS PER MONTH */}
      <div style={{ height: "300px" }}>
        <h2>New Users per Month</h2>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={newUsersByMonth}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}