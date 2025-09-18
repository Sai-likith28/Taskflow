import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { 
  Plus, 
  LogOut, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Edit,
  Trash2,
  BarChart3,
  User,
  Brain,
  Sparkles,
  Lightbulb,
  Target,
  Calendar
} from "lucide-react";
const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://taskflow-qo7j.onrender.com"
    : "http://127.0.0.1:8000");
const API = `${BACKEND_URL}/api`;

// Auth context
const AuthContext = React.createContext();

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      await fetchUser();
      toast.success("Login successful!");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || "Login failed");
      return false;
    }
  };

  const register = async (email, password, full_name) => {
    try {
      const response = await axios.post(`${API}/auth/register`, { 
        email, 
        password, 
        full_name 
      });
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      await fetchUser();
      toast.success("Registration successful!");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    toast.success("Logged out successfully");
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let success;
    if (isLogin) {
      success = await login(email, password);
    } else {
      success = await register(email, password, fullName);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-slate-800">
            {isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
          <p className="text-slate-600">
            {isLogin ? "Sign in to TaskFlow" : "Join TaskFlow today"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Enter your full name"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </div>
            <Button type="submit" className="w-full h-10 bg-slate-900 text-white hover:bg-slate-800" disabled={loading}>
              {loading ? "Please wait..." : (isLogin ? "Sign In" : "Create Account")}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => setIsLogin(!isLogin)}
              className="text-slate-600"
            >
              {isLogin 
                ? "Don't have an account? Sign up" 
                : "Already have an account? Sign in"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const TaskForm = ({ task, onSave, onCancel }) => {
  const pad = (n) => String(n).padStart(2, '0')
  const parseToLocalParts = (isoString) => {
    try {
      const d = new Date(isoString)
      const yyyy = d.getFullYear()
      const mm = pad(d.getMonth() + 1)
      const dd = pad(d.getDate())
      let hour = d.getHours()
      const minute = pad(d.getMinutes())
      const ampm = hour >= 12 ? 'PM' : 'AM'
      hour = hour % 12
      if (hour === 0) hour = 12
      return {
        date: `${yyyy}-${mm}-${dd}`,
        hour: String(hour),
        minute,
        ampm
      }
    } catch {
      return { date: '', hour: '12', minute: '00', ampm: 'AM' }
    }
  }
  const initialParts = task?.due_date ? parseToLocalParts(task.due_date) : { date: '', hour: '12', minute: '00', ampm: 'AM' }
  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    priority: task?.priority || "medium",
    status: task?.status || "pending",
    due_date_date: initialParts.date,
    due_date_hour: initialParts.hour,
    due_date_minute: initialParts.minute,
    due_date_ampm: initialParts.ampm,
  });

  const buildDueISO = () => {
    if (!formData.due_date_date) return null
    let hour = parseInt(formData.due_date_hour || '12', 10)
    const minute = parseInt(formData.due_date_minute || '0', 10)
    if (formData.due_date_ampm === 'PM' && hour < 12) hour += 12
    if (formData.due_date_ampm === 'AM' && hour === 12) hour = 0
    const local = new Date(formData.due_date_date)
    local.setHours(hour, minute, 0, 0)
    return local.toISOString()
  }
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dueISO = buildDueISO()
    const payload = {
      title: formData.title,
      description: formData.description,
      priority: formData.priority,
      status: formData.status,
      due_date: dueISO
    };
    await onSave(payload);
  };

  const getAIPrioritySuggestion = async () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a task title first");
      return;
    }

    setLoadingAI(true);
    try {
      const response = await axios.post(`${API}/ai/analyze-priority`, {
        title: formData.title,
        description: formData.description,
        due_date: buildDueISO()
      });
      
      setAiSuggestion(response.data);
      toast.success("AI priority analysis completed!");
    } catch (error) {
      toast.error("AI analysis failed. Please try again.");
    }
    setLoadingAI(false);
  };

  const applyAISuggestion = () => {
    if (aiSuggestion) {
      setFormData({...formData, priority: aiSuggestion.suggested_priority});
      toast.success("AI suggestion applied!");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          required
          placeholder="Task title"
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          placeholder="Task description"
          rows={4}
          className="resize-none"
        />
      </div>
      
      {/* AI Priority Suggestion */}
      <div className="bg-slate-50 p-4 rounded-lg border border-blue-100">
        <div className="flex items-center justify-between mb-3">
          <Label className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-blue-600" />
            AI Priority Assistant
          </Label>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={getAIPrioritySuggestion}
            disabled={loadingAI}
          >
            {loadingAI ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 mr-2" />
                Get AI Suggestion
              </>
            )}
          </Button>
        </div>
        
        {aiSuggestion && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={
                `px-2 py-0.5 rounded-full text-xs font-semibold ${
                  aiSuggestion.suggested_priority === 'high' ? 'bg-red-600 text-white' :
                  aiSuggestion.suggested_priority === 'medium' ? 'bg-blue-600 text-white' :
                  'bg-emerald-600 text-white'
                }`
              }>
                Suggested: {aiSuggestion.suggested_priority.toUpperCase()}
              </span>
              <span className="text-sm text-slate-600">
                Urgency Score: {aiSuggestion.urgency_score}/10
              </span>
            </div>
            <p className="text-sm text-slate-700">{aiSuggestion.reasoning}</p>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={applyAISuggestion}
            >
              <Target className="w-3 h-3 mr-2" />
              Apply Suggestion
            </Button>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select 
            value={formData.priority} 
            onValueChange={(value) => setFormData({...formData, priority: value})}
          >
            <SelectTrigger id="priority">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select 
            value={formData.status} 
            onValueChange={(value) => setFormData({...formData, status: value})}
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Due Date & Time</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              type="date"
              className="pl-9"
              value={formData.due_date_date}
              onChange={(e) => setFormData({...formData, due_date_date: e.target.value})}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <select
                className="w-full appearance-none rounded-md border border-input bg-white pl-9 pr-3 h-10 text-sm"
                value={formData.due_date_hour}
                onChange={(e) => setFormData({...formData, due_date_hour: e.target.value})}
              >
                {Array.from({length:12},(_,i)=>i+1).map(h=> (
                  <option key={h} value={String(h)}>{h}</option>
                ))}
              </select>
            </div>
            <select
              className="w-full appearance-none rounded-md border border-input bg-white h-10 text-sm"
              value={formData.due_date_minute}
              onChange={(e) => setFormData({...formData, due_date_minute: e.target.value})}
            >
              {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              className="w-full appearance-none rounded-md border border-input bg-white h-10 text-sm"
              value={formData.due_date_ampm}
              onChange={(e) => setFormData({...formData, due_date_ampm: e.target.value})}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1 h-10 bg-blue-600 text-white hover:bg-blue-700">
          {task ? "Update Task" : "Create Task"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="h-10">
          Cancel
        </Button>
      </div>
    </form>
  );
};

const TaskCard = ({ task, onEdit, onDelete }) => {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "default";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "in_progress": return <Clock className="w-4 h-4 text-blue-600" />;
      default: return <AlertCircle className="w-4 h-4 text-amber-600" />;
    }
  };

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(task.id);
  };

  const handleEdit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(task);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {getStatusIcon(task.status)}
            <h3 className="font-semibold text-slate-800">{task.title}</h3>
          </div>
          <div className="flex gap-1" style={{ zIndex: 10 }}>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleEdit}
              style={{ pointerEvents: 'auto' }}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleDelete}
              style={{ pointerEvents: 'auto' }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {task.description && (
          <p className="text-slate-600 text-sm mb-3">{task.description}</p>
        )}
        
        <div className="flex items-center justify-between">
          <span className={
            `px-2 py-0.5 rounded-full text-xs font-semibold ${
              task.priority === 'high' ? 'bg-red-600 text-white' :
              task.priority === 'medium' ? 'bg-blue-600 text-white' :
              'bg-emerald-600 text-white'
            }`
          }>
            {task.priority.toUpperCase()}
          </span>
          
          {task.due_date && (
            <span className="text-xs text-slate-500">
              Due: {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingAISummary, setLoadingAISummary] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${API}/tasks`);
      setTasks(response.data);
    } catch (error) {
      toast.error("Failed to fetch tasks");
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error("Failed to fetch stats");
    }
  };

  const fetchAISummary = async () => {
    setLoadingAISummary(true);
    try {
      const response = await axios.get(`${API}/ai/task-summary`);
      setAiSummary(response.data);
      toast.success("AI summary generated!");
    } catch (error) {
      toast.error("Failed to generate AI summary");
    }
    setLoadingAISummary(false);
  };

  const handleCreateTask = async (taskData) => {
    try {
      await axios.post(`${API}/tasks`, taskData);
      toast.success("Task created successfully");
      setShowTaskDialog(false);
      fetchTasks();
      fetchStats();
    } catch (error) {
      toast.error("Failed to create task");
    }
  };

  const handleUpdateTask = async (taskData) => {
    try {
      await axios.put(`${API}/tasks/${editingTask.id}`, taskData);
      toast.success("Task updated successfully");
      setEditingTask(null);
      fetchTasks();
      fetchStats();
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    
    try {
      await axios.delete(`${API}/tasks/${taskId}`);
      toast.success("Task deleted successfully");
      fetchTasks();
      fetchStats();
    } catch (error) {
      toast.error("Failed to delete task");
    }
  };

  const filterTasks = (status) => {
    return tasks.filter(task => task.status === status);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 mx-auto"></div>
          <p className="mt-2 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-slate-700" />
              <h1 className="text-xl font-bold text-slate-800">TaskFlow</h1>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Sparkles className="w-3 h-3 mr-1" />
                AI-Powered
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-600">
                <User className="w-4 h-4" />
                <span>{user.full_name}</span>
              </div>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Tasks</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.total_tasks || 0}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Pending</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.pending_tasks || 0}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-amber-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">In Progress</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.in_progress_tasks || 0}</p>
                </div>
                <Clock className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{stats.completed_tasks || 0}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Summary Section */}
        {tasks.length > 0 && (
          <Card className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <Brain className="w-5 h-5" />
                  AI Task Summary
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={fetchAISummary}
                  disabled={loadingAISummary}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  {loadingAISummary ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-2" />
                      Generate Summary
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            {aiSummary && (
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-slate-700 mb-2">Overview</h4>
                    <p className="text-slate-600">{aiSummary.summary}</p>
                  </div>
                  
                  {aiSummary.insights.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4" />
                        Key Insights
                      </h4>
                      <ul className="space-y-1">
                        {aiSummary.insights.map((insight, index) => (
                          <li key={index} className="text-slate-600 flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {aiSummary.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Recommendations
                      </h4>
                      <ul className="space-y-1">
                        {aiSummary.recommendations.map((rec, index) => (
                          <li key={index} className="text-slate-600 flex items-start gap-2">
                            <span className="text-green-500 mt-1">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Tasks Section */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Your Tasks</h2>
          {/* Create Task Dialog */}
          <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
            <DialogTrigger asChild>
              <Button className="h-10 bg-blue-600 text-white hover:bg-blue-700 shadow">
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent aria-describedby="create-task-description" className="sm:max-w-[640px]">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <div id="create-task-description" className="sr-only">
                Create a new task with title, description, priority, status and due date
              </div>
              <TaskForm
                onSave={handleCreateTask}
                onCancel={() => setShowTaskDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Task Dialog */}
        <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
          <DialogContent aria-describedby="edit-task-description">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
            </DialogHeader>
            <div id="edit-task-description" className="sr-only">
              Edit the selected task's details including title, description, priority, status and due date
            </div>
            {editingTask && (
              <TaskForm
                task={editingTask}
                onSave={handleUpdateTask}
                onCancel={() => setEditingTask(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Task Tabs */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Tasks</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={setEditingTask}
                  onDelete={handleDeleteTask}
                />
              ))}
              {tasks.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <p className="text-slate-500">No tasks yet. Create your first task to get started!</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="pending" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterTasks('pending').map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={setEditingTask}
                  onDelete={handleDeleteTask}
                />
              ))}
              {filterTasks('pending').length === 0 && (
                <div className="col-span-full text-center py-12">
                  <p className="text-slate-500">No pending tasks</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="in_progress" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterTasks('in_progress').map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={setEditingTask}
                  onDelete={handleDeleteTask}
                />
              ))}
              {filterTasks('in_progress').length === 0 && (
                <div className="col-span-full text-center py-12">
                  <p className="text-slate-500">No tasks in progress</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="completed" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterTasks('completed').map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={setEditingTask}
                  onDelete={handleDeleteTask}
                />
              ))}
              {filterTasks('completed').length === 0 && (
                <div className="col-span-full text-center py-12">
                  <p className="text-slate-500">No completed tasks</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="App">
          <Toaster />
          <AppContent />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 mx-auto"></div>
          <p className="mt-2 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Dashboard /> : <LoginForm />}
      />
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
};

export default App;
