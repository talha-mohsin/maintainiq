/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Asset from '../models/Asset.js';
import Issue from '../models/Issue.js';
import User from '../models/User.js';
import Maintenance from '../models/Maintenance.js';
import { cacheService } from '../config/cache.js';

export const getDashboardStats = async (req, res) => {
  const cacheKey = 'dashboard:stats';
  try {
    const cachedStats = await cacheService.get(cacheKey);
    if (cachedStats) {
      return res.json({ stats: cachedStats });
    }

    const assets = await Asset.find({});
    const issues = await Issue.find({});
    const users = await User.find({});
    const maintenances = await Maintenance.find({});

    const totalAssets = assets.length;
    const operational = assets.filter(a => a.status === 'Operational').length;
    const underMaintenance = assets.filter(a => a.status === 'Under Maintenance').length;
    const outOfService = assets.filter(a => a.status === 'Out of Service').length;

    const resolvedIssues = issues.filter(i => ['Resolved', 'Closed'].includes(i.status)).length;
    const openIssues = issues.filter(i => !['Resolved', 'Closed'].includes(i.status)).length;

    const totalTechnicians = users.filter(u => u.role === 'Technician').length;

    // Tasks today: assigned issues created or updated today
    const todayStr = new Date().toISOString().split('T')[0];
    const tasksToday = issues.filter(i => {
      const createdStr = i.createdAt ? i.createdAt.toISOString().split('T')[0] : '';
      const completedStr = i.completedDate ? i.completedDate.toISOString().split('T')[0] : '';
      return createdStr === todayStr || completedStr === todayStr;
    }).length;

    // Category distribution
    const categories = {};
    assets.forEach(a => {
      if (a.category) {
        categories[a.category] = (categories[a.category] || 0) + 1;
      }
    });
    const categoryDistribution = Object.entries(categories).map(([name, value]) => ({ name, value }));

    // Priority distribution
    const priorities = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    issues.filter(i => !['Resolved', 'Closed'].includes(i.status)).forEach(i => {
      if (i.priority in priorities) {
        priorities[i.priority] += 1;
      }
    });
    const priorityDistribution = Object.entries(priorities).map(([name, value]) => ({ name, value }));

    // Monthly costs (Group maintenance by Month/Year)
    const monthlyData = {};
    maintenances.forEach(m => {
      if (m.completedDate) {
        const date = new Date(m.completedDate);
        const label = date.toLocaleString('default', { month: 'short', year: '2-digit' }); // e.g. Jul 26
        if (!monthlyData[label]) {
          monthlyData[label] = { cost: 0, count: 0 };
        }
        monthlyData[label].cost += m.cost;
        monthlyData[label].count += 1;
      }
    });
    const monthlyMaintenanceCost = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      cost: Math.round(data.cost),
      count: data.count
    })).slice(-6); // Last 6 months

    // Technician performance: completed vs pending assigned issues
    const techPerf = {};
    users.filter(u => u.role === 'Technician').forEach(t => {
      techPerf[t.name] = { completed: 0, pending: 0 };
    });

    issues.forEach(i => {
      if (i.assignedTechnicianName && techPerf[i.assignedTechnicianName] !== undefined) {
        if (['Resolved', 'Closed'].includes(i.status)) {
          techPerf[i.assignedTechnicianName].completed += 1;
        } else {
          techPerf[i.assignedTechnicianName].pending += 1;
        }
      }
    });

    const technicianPerformance = Object.entries(techPerf).map(([name, data]) => ({
      name,
      completed: data.completed,
      pending: data.pending
    }));

    const stats = {
      totalAssets,
      operational,
      underMaintenance,
      outOfService,
      resolvedIssues,
      openIssues,
      totalTechnicians,
      tasksToday,
      categoryDistribution,
      priorityDistribution,
      monthlyMaintenanceCost,
      technicianPerformance
    };

    await cacheService.set(cacheKey, stats, 120); // Cache for 2 minutes

    res.json({ stats });
  } catch (err) {
    console.error("getDashboardStats error:", err);
    res.status(500).json({ error: 'Server error retrieving dashboard statistics' });
  }
};
