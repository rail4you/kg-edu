// Frontend view tracking utilities for courses
// Uses localStorage to persist view counts across sessions

interface ViewStats {
  totalViews: number;
  uniqueUsers: Set<string>;
  lastViewed: string;
}

interface CourseViewData {
  [courseId: string]: ViewStats;
}

const STORAGE_KEY = 'course_view_stats';
const USER_ID_KEY = 'course_view_user_id';

// Generate or get a unique user ID for view tracking
function getUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    // Generate a unique ID based on timestamp and random string
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

// Get all view statistics from localStorage
function getViewStats(): CourseViewData {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return {};
  }

  try {
    const data = JSON.parse(stored);
    // Convert the string arrays back to Sets for unique users
    Object.keys(data).forEach(courseId => {
      if (Array.isArray(data[courseId].uniqueUsers)) {
        data[courseId].uniqueUsers = new Set(data[courseId].uniqueUsers);
      }
    });
    return data;
  } catch (error) {
    console.error('Error parsing view stats from localStorage:', error);
    return {};
  }
}

// Save view statistics to localStorage
function saveViewStats(stats: CourseViewData): void {
  // Convert Sets to arrays for JSON serialization
  const serialized = JSON.parse(JSON.stringify(stats, (key, value) => {
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  }));

  localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
}

// Track a course view
export function trackCourseView(courseId: string): void {
  if (!courseId) return;

  const userId = getUserId();
  const stats = getViewStats();

  if (!stats[courseId]) {
    stats[courseId] = {
      totalViews: 0,
      uniqueUsers: new Set(),
      lastViewed: new Date().toISOString()
    };
  }

  // Increment total views
  stats[courseId].totalViews++;

  // Add user to unique users set
  stats[courseId].uniqueUsers.add(userId);

  // Update last viewed timestamp
  stats[courseId].lastViewed = new Date().toISOString();

  saveViewStats(stats);
}

// Get view statistics for a specific course
export function getCourseViewStats(courseId: string): {
  totalViews: number;
  uniqueViews: number;
  lastViewed: string | null;
} {
  if (!courseId) {
    return { totalViews: 0, uniqueViews: 0, lastViewed: null };
  }

  const stats = getViewStats();
  const courseStats = stats[courseId];

  if (!courseStats) {
    return { totalViews: 0, uniqueViews: 0, lastViewed: null };
  }

  return {
    totalViews: courseStats.totalViews,
    uniqueViews: courseStats.uniqueUsers.size || 0,
    lastViewed: courseStats.lastViewed
  };
}

// Get view statistics for all courses
export function getAllCourseViewStats(): CourseViewData {
  return getViewStats();
}

// Reset view statistics for a specific course
export function resetCourseViewStats(courseId: string): void {
  if (!courseId) return;

  const stats = getViewStats();
  delete stats[courseId];
  saveViewStats(stats);
}

// Reset all view statistics
export function resetAllViewStats(): void {
  localStorage.removeItem(STORAGE_KEY);
}