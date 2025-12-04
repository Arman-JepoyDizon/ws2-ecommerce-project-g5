// src/controllers/reportController.js
const ExcelJS = require('exceljs');

// --- Date Helpers (Same as dashboardController) ---
function getPHStartOfDay(dateString) {
    return new Date(`${dateString}T00:00:00+08:00`);
}

function getPHEndOfDay(dateString) {
    return new Date(`${dateString}T23:59:59.999+08:00`);
}

function formatToPHDateString(dateObj) {
    return dateObj.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function formatToPHDateTimeString(dateObj) {
    return dateObj.toLocaleString("en-US", { timeZone: "Asia/Manila" });
}

// --- Helper to Fetch Filtered Orders ---
async function fetchReportData(db, query) {
    const { dateRange, status } = query;
    let startDate, endDate;

    // Date Logic
    if (dateRange) {
        const dates = dateRange.split(' to ');
        startDate = dates[0];
        endDate = dates[1] || dates[0];
    }

    if (!startDate || !endDate) {
        const nowPH = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
        const end = new Date(nowPH);
        const start = new Date(nowPH);
        start.setDate(start.getDate() - 30);
        
        const format = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
        startDate = format(start);
        endDate = format(end);
    }

    const startQuery = getPHStartOfDay(startDate);
    const endQuery = getPHEndOfDay(endDate);

    // Build DB Query
    const dbQuery = {
        createdAt: { $gte: startQuery, $lte: endQuery }
    };

    if (status && status !== 'all') {
        dbQuery.orderStatus = status;
    }

    // Fetch Orders
    const orders = await db.collection("orders").find(dbQuery).sort({ createdAt: 1 }).toArray();

    // Fetch Users (for email lookup)
    const userIds = [...new Set(orders.map(o => o.userId))];
    const users = await db.collection("users").find({ userId: { $in: userIds } }).toArray();
    const userMap = {};
    users.forEach(u => userMap[u.userId] = u);

    return { orders, userMap, startDate, endDate, status: status || 'all' };
}

// --- 1. GET Sales Report Page ---
exports.getSalesReport = async (req, res) => {
    const db = req.app.locals.db;
    
    try {
        const { orders, startDate, endDate, status } = await fetchReportData(db, req.query);

        // Aggregation: Daily Sales
        const dailyData = {};
        let totalRevenue = 0;
        let totalOrders = 0;

        // Pre-fill dates
        let currentIterDate = getPHStartOfDay(startDate);
        const endIterDate = getPHEndOfDay(endDate);
        
        while (currentIterDate <= endIterDate) {
            const dateStr = formatToPHDateString(currentIterDate);
            dailyData[dateStr] = { date: dateStr, orders: 0, sales: 0 };
            currentIterDate.setDate(currentIterDate.getDate() + 1);
        }

        orders.forEach(order => {
            const dateStr = formatToPHDateString(order.createdAt);
            if (dailyData[dateStr]) {
                dailyData[dateStr].orders += 1;
                dailyData[dateStr].sales += (order.totalAmount || 0);
                totalRevenue += (order.totalAmount || 0);
                totalOrders += 1;
            }
        });

        const dailySales = Object.values(dailyData);

        res.render("dashboard/reports/sales", {
            user: req.session.user,
            dailySales,
            totalRevenue,
            totalOrders,
            dateRange: `${startDate} to ${endDate}`,
            status,
            success: null,
            error: null
        });

    } catch (err) {
        console.error("Report Error:", err);
        res.status(500).send("Server Error");
    }
};

// --- 2. EXPORT Daily Sales (XLSX) ---
exports.downloadDailySales = async (req, res) => {
    const db = req.app.locals.db;
    try {
        const { orders, startDate, endDate } = await fetchReportData(db, req.query);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Daily Sales');

        sheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Total Orders', key: 'orders', width: 15 },
            { header: 'Total Sales', key: 'sales', width: 20 }
        ];

        // Aggregate Data
        const dailyData = {};
        let current = getPHStartOfDay(startDate);
        const end = getPHEndOfDay(endDate);
        while (current <= end) {
            const d = formatToPHDateString(current);
            dailyData[d] = { date: d, orders: 0, sales: 0 };
            current.setDate(current.getDate() + 1);
        }

        orders.forEach(o => {
            const d = formatToPHDateString(o.createdAt);
            if (dailyData[d]) {
                dailyData[d].orders++;
                dailyData[d].sales += (o.totalAmount || 0);
            }
        });

        // Add Rows
        Object.values(dailyData).forEach(row => {
            sheet.addRow(row);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=daily_sales_report.xlsx');
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error("Export Error:", err);
        res.status(500).send("Export Failed");
    }
};

// --- 3. EXPORT Detailed Orders (XLSX) ---
exports.downloadDetailedOrders = async (req, res) => {
    const db = req.app.locals.db;
    try {
        const { orders, userMap } = await fetchReportData(db, req.query);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Detailed Orders');

        sheet.columns = [
            { header: 'Order ID', key: 'id', width: 36 },
            { header: 'Date/Time', key: 'date', width: 25 },
            { header: 'Customer Email', key: 'email', width: 30 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Total Amount', key: 'total', width: 15 }
        ];

        orders.forEach(o => {
            const user = userMap[o.userId];
            sheet.addRow({
                id: o.orderId,
                date: formatToPHDateTimeString(o.createdAt),
                email: user ? user.email : "Unknown",
                status: o.orderStatus,
                total: o.totalAmount
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=detailed_orders_report.xlsx');
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error("Export Error:", err);
        res.status(500).send("Export Failed");
    }
};