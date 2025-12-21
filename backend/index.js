require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { execFile } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Lightweight in-memory upload handler for small images (nutrition labels)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

// Database setup
const db = new sqlite3.Database('./macro_meal_planner.db');
// In-memory request tracking for AI suggestions
const aiRequests = {}; // { requestId: { status, suggestions, error, createdAt, mealId, userId } }

// Generate unique request ID
const generateRequestId = () => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Cleanup old requests (older than 30 minutes)
setInterval(() => {
  const now = Date.now();
  const thirtyMinutesAgo = now - (30 * 60 * 1000);
  Object.keys(aiRequests).forEach(requestId => {
    if (aiRequests[requestId].createdAt < thirtyMinutesAgo) {
      delete aiRequests[requestId];
    }
  });
}, 5 * 60 * 1000); // Run cleanup every 5 minutes

// Database setup
// Initialize database tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert admin user if not exists
  db.get('SELECT * FROM users WHERE username = ?', ['admin'], async (err, row) => {
    if (!row) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      db.run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', 
        ['admin', 'admin@example.com', hashedPassword]);
    }
  });

  // Create user macro goals table
  db.run(`CREATE TABLE IF NOT EXISTS user_macro_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    calories INTEGER NOT NULL,
    protein REAL NOT NULL,
    carbs REAL NOT NULL,
    fat REAL NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Create meals table
  db.run(`CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    time_start TEXT NOT NULL,
    time_end TEXT NOT NULL,
    protein_percentage REAL DEFAULT 0,
    carbs_percentage REAL DEFAULT 0,
    fat_percentage REAL DEFAULT 0,
    preferences TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Create foods table
  db.run(`CREATE TABLE IF NOT EXISTS foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    brand TEXT,
    serving_size TEXT NOT NULL,
    calories_per_serving INTEGER NOT NULL,
    protein_per_serving REAL NOT NULL,
    carbs_per_serving REAL NOT NULL,
    fat_per_serving REAL NOT NULL,
    is_common BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS user_food_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    food_id INTEGER NOT NULL,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (food_id) REFERENCES foods (id),
    UNIQUE(user_id, food_id)
  )`);

  // Create meal plans table
  db.run(`CREATE TABLE IF NOT EXISTS meal_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    meal_id INTEGER NOT NULL,
    food_id INTEGER,
    quantity REAL NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (meal_id) REFERENCES meals (id),
    FOREIGN KEY (food_id) REFERENCES foods (id)
  )`);

  // Create linked foods table
  db.run(`CREATE TABLE IF NOT EXISTS linked_foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Create linked food components table
  db.run(`CREATE TABLE IF NOT EXISTS linked_food_components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    linked_food_id INTEGER NOT NULL,
    food_id INTEGER NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    FOREIGN KEY (linked_food_id) REFERENCES linked_foods (id),
    FOREIGN KEY (food_id) REFERENCES foods (id)
  )`);

  // Create AI configuration table
  db.run(`CREATE TABLE IF NOT EXISTS ai_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    openai_enabled BOOLEAN DEFAULT 0,
    openai_api_key TEXT,
    ollama_enabled BOOLEAN DEFAULT 0,
    ollama_endpoint TEXT DEFAULT 'http://localhost:11434',
    ollama_model TEXT,
    preferred_service TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Create meal calorie allocations table
  db.run(`CREATE TABLE IF NOT EXISTS meal_calorie_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_daily_calories REAL NOT NULL,
    meals_ratio REAL DEFAULT 0.75,
    snacks_ratio REAL DEFAULT 0.25,
    use_auto_calculation BOOLEAN DEFAULT 1,
    custom_allocations TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id)
  )`);

  // Add columns to existing tables (safe no-op when already present)
  db.run(`ALTER TABLE foods ADD COLUMN active BOOLEAN DEFAULT 1`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding active column to foods:', err);
    }
  });

  db.run(`ALTER TABLE foods ADD COLUMN fiber_per_serving REAL DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding fiber column to foods:', err);
    }
  });

  db.run(`ALTER TABLE user_macro_goals ADD COLUMN fiber REAL DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding fiber column to user_macro_goals:', err);
    }
  });

  db.run(`ALTER TABLE user_macro_goals ADD COLUMN track_net_carbs INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding track_net_carbs column to user_macro_goals:', err);
    }
  });

  db.run(`ALTER TABLE ai_config ADD COLUMN openai_model TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding openai_model column to ai_config:', err);
    }
  });

  db.run(`ALTER TABLE meal_calorie_allocations ADD COLUMN use_auto_calculation BOOLEAN DEFAULT 1`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding use_auto_calculation column to meal_calorie_allocations:', err);
    }
  });

  db.run(`ALTER TABLE meal_calorie_allocations ADD COLUMN custom_allocations TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding custom_allocations column to meal_calorie_allocations:', err);
    }
  });

  // Seed defaults on first run (idempotent via row counts)
  const runSeedIfEmpty = (table, whereClause, seedScript) => {
    const clause = whereClause || '1=1';
    db.get(`SELECT COUNT(*) as count FROM ${table} WHERE ${clause}`, (err, row) => {
      if (err) {
        console.error(`Error checking ${table} for seeding:`, err);
        return;
      }
      if (!row || row.count > 0) return;
      const scriptPath = path.join(__dirname, seedScript);
      console.log(`Seeding ${table} via ${seedScript}...`);
      execFile('node', [scriptPath], { cwd: __dirname }, (seedErr, stdout, stderr) => {
        if (seedErr) {
          console.error(`Seed script ${seedScript} failed:`, seedErr, stderr);
        } else if (stdout) {
          console.log(stdout.trim());
        }
      });
    });
  };

  runSeedIfEmpty('foods', 'is_common = 1', 'seed_common_foods.js');
  runSeedIfEmpty('meals', '1=1', 'seed_meals.js');
});

// Middleware
// CORS
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://5173-5f449670-b992-4b6b-92c2-a0cb7f1ade5f.proxy.daytona.works'
];
const envAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
const allowedOrigins = [...defaultAllowedOrigins, ...envAllowedOrigins];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if the origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    
    db.run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', 
      [username, email, passwordHash], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'Username or email already exists' });
        return res.status(500).json({ error: 'Registration failed' });
      }
          }

      const token = jwt.sign(
        { userId: this.lastID, username, email, role: 'user' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'User created successfully',
        token,
        user: { id: this.lastID, username, email, role: 'user' }
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err || !user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username, email: user.email, role: 'user' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: { id: user.id, username: user.username, email: user.email, role: 'user' }
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: { id: req.user.userId, username: req.user.username, email: req.user.email } });
});

// Profile routes
app.get('/api/profile', authenticateToken, (req, res) => {
  res.json({ 
    profile: {
      macro_protein_g: 150,
      macro_carbs_g: 200,
      macro_fat_g: 65,
      macro_calories: 2000
    }
  });
});

// Common foods
app.get('/api/foods/common', (req, res) => {
  const foods = [
    { id: 1, name: 'Chicken Breast', serving_size: '100', serving_unit: 'g', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
    { id: 2, name: 'Brown Rice', serving_size: '1', serving_unit: 'cup', calories: 216, protein: 5, carbs: 45, fat: 1.8, fiber: 3.5 },
    { id: 3, name: 'Broccoli', serving_size: '1', serving_unit: 'cup', calories: 31, protein: 2.6, carbs: 6, fat: 0.3, fiber: 2.4 },
    { id: 4, name: 'Eggs', serving_size: '2', serving_unit: 'large', calories: 143, protein: 12, carbs: 0.7, fat: 9.5, fiber: 0 },
    { id: 5, name: 'Greek Yogurt', serving_size: '1', serving_unit: 'cup', calories: 100, protein: 17, carbs: 6, fat: 0.7, fiber: 0 }
  ];
  res.json({ foods });
});

// Macro goals routes
app.get('/api/macro-goals', authenticateToken, (req, res) => {
  db.get('SELECT * FROM user_macro_goals WHERE user_id = ? AND is_active = 1', [req.user.userId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(row || {});
  });
});

app.post('/api/macro-goals', authenticateToken, (req, res) => {
  const { calories, protein, carbs, fat, fiber } = req.body;
  const track_net_carbs = req.body.track_net_carbs || 0;
  
  if (!calories || !protein || !carbs || !fat) {
    return res.status(400).json({ error: 'All macro values are required' });
  }

  // Deactivate existing goals
  db.run('UPDATE user_macro_goals SET is_active = 0 WHERE user_id = ?', [req.user.userId], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Insert new goals
    db.run('INSERT INTO user_macro_goals (user_id, calories, protein, carbs, fat, fiber, track_net_carbs) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.userId, calories, protein, carbs, fat, fiber || 0, track_net_carbs], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to save macro goals' });
      }
      
      res.status(201).json({
        message: 'Macro goals saved successfully',
        goals: {
          id: this.lastID,
          user_id: req.user.userId,
          calories,
          protein,
          carbs,
          fat,
          fiber: fiber || 0,
          track_net_carbs,
          is_active: 1
          }
      });
    });
  });
});

// Meal Calorie Allocations routes
app.get('/api/meal-calorie-allocations', authenticateToken, (req, res) => {
  db.get('SELECT * FROM meal_calorie_allocations WHERE user_id = ?', [req.user.userId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    // Parse custom_allocations if it exists
    if (row && row.custom_allocations) {
      try {
        row.custom_allocations = JSON.parse(row.custom_allocations);
      } catch (e) {
        row.custom_allocations = null;
      }
    }
    // Return default values if no allocation exists
    res.json(row || {
      total_daily_calories: 2000,
      meals_ratio: 0.75,
      snacks_ratio: 0.25,
      use_auto_calculation: true,
      custom_allocations: null
    });
  });
});

app.post('/api/meal-calorie-allocations', authenticateToken, (req, res) => {
  const { total_daily_calories, meals_ratio, snacks_ratio, use_auto_calculation, custom_allocations } = req.body;

  if (!total_daily_calories || meals_ratio === undefined || snacks_ratio === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const useAuto = use_auto_calculation !== undefined ? use_auto_calculation : true;
  const customAllocsJson = custom_allocations ? JSON.stringify(custom_allocations) : null;

  // Check if allocation already exists
  db.get('SELECT id FROM meal_calorie_allocations WHERE user_id = ?', [req.user.userId], (err, existingRow) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingRow) {
      // Update existing
      db.run('UPDATE meal_calorie_allocations SET total_daily_calories = ?, meals_ratio = ?, snacks_ratio = ?, use_auto_calculation = ?, custom_allocations = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [total_daily_calories, meals_ratio, snacks_ratio, useAuto, customAllocsJson, req.user.userId], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to update meal calorie allocations' });
        }
        res.json({ message: 'Meal calorie allocations updated successfully' });
      });
    } else {
      // Insert new
      db.run('INSERT INTO meal_calorie_allocations (user_id, total_daily_calories, meals_ratio, snacks_ratio, use_auto_calculation, custom_allocations) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.userId, total_daily_calories, meals_ratio, snacks_ratio, useAuto, customAllocsJson], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to save meal calorie allocations' });
        }
        res.status(201).json({ message: 'Meal calorie allocations saved successfully' });
      });
    }
  });
});

app.get('/api/meals/calorie-targets', authenticateToken, (req, res) => {
  db.get('SELECT * FROM user_macro_goals WHERE user_id = ? AND is_active = 1', [req.user.userId], (err, macroGoals) => {
    if (err || !macroGoals) {
      return res.status(400).json({ error: 'No active macro goals found. Please set macro goals first.' });
    }

    db.get('SELECT * FROM meal_calorie_allocations WHERE user_id = ?', [req.user.userId], (err, allocation) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Use provided allocation or defaults
      const totalCalories = allocation?.total_daily_calories || macroGoals.calories;
      const mealsRatio = allocation?.meals_ratio || 0.75;
      const snacksRatio = allocation?.snacks_ratio || 0.25;
      const useAutoCalculation = allocation?.use_auto_calculation !== 0; // SQLite boolean is 0/1

      db.all('SELECT * FROM meals WHERE user_id = ? ORDER BY time_start', [req.user.userId], (err, meals) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        let targets = {};

        // Check if using custom allocations
        if (!useAutoCalculation && allocation?.custom_allocations) {
          try {
            const customAllocs = typeof allocation.custom_allocations === 'string' 
              ? JSON.parse(allocation.custom_allocations) 
              : allocation.custom_allocations;
            targets = customAllocs;
          } catch (e) {
            // If parsing fails, fall back to auto-calculation
          }
        }

        // If targets is still empty (auto-calculation or parse error), calculate automatically
        if (Object.keys(targets).length === 0) {
          // Calculate targets for each meal
          // Group meals into "meal" vs "snack" categories
          const mealCategories = {};
          meals.forEach(meal => {
            const category = meal.type === 'snack' ? 'snack' : 'meal';
            if (!mealCategories[category]) {
              mealCategories[category] = [];
            }
            mealCategories[category].push(meal);
          });

          meals.forEach(meal => {
            const category = meal.type === 'snack' ? 'snack' : 'meal';
            const count = mealCategories[category].length;
            const ratio = category === 'snack' ? snacksRatio : mealsRatio;
            const caloriesForCategory = totalCalories * ratio;
            targets[meal.id] = Math.round(caloriesForCategory / count);
          });
        }

        res.json({
          total_daily_calories: totalCalories,
          meals_ratio: mealsRatio,
          snacks_ratio: snacksRatio,
          meal_targets: targets
        });
      });
    });
  });
});

// Meals routes
app.get('/api/meals', authenticateToken, (req, res) => {
  db.all('SELECT * FROM meals WHERE user_id = ? ORDER BY time_start', [req.user.userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/meals', authenticateToken, (req, res) => {
  const { name, type, time_start, time_end, protein_percentage, carbs_percentage, fat_percentage, preferences } = req.body;
  
  if (!name || !type || !time_start || !time_end) {
    return res.status(400).json({ error: 'Name, type, and time ranges are required' });
  }

  db.run('INSERT INTO meals (user_id, name, type, time_start, time_end, protein_percentage, carbs_percentage, fat_percentage, preferences) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.userId, name, type, time_start, time_end, protein_percentage || 0, carbs_percentage || 0, fat_percentage || 0, preferences], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to create meal' });
    }
    
    res.status(201).json({
      message: 'Meal created successfully',
      meal: {
        id: this.lastID,
        user_id: req.user.userId,
        name,
        type,
        time_start,
        time_end,
        protein_percentage: protein_percentage || 0,
        carbs_percentage: carbs_percentage || 0,
        fat_percentage: fat_percentage || 0,
        preferences
      }
    });
  });
});

app.put('/api/meals/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, type, time_start, time_end, protein_percentage, carbs_percentage, fat_percentage, preferences } = req.body;
  
  db.run('UPDATE meals SET name = ?, type = ?, time_start = ?, time_end = ?, protein_percentage = ?, carbs_percentage = ?, fat_percentage = ?, preferences = ? WHERE id = ? AND user_id = ?',
    [name, type, time_start, time_end, protein_percentage || 0, carbs_percentage || 0, fat_percentage || 0, preferences, id, req.user.userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to update meal' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Meal not found' });
    }
    
    res.json({ message: 'Meal updated successfully' });
  });
});

app.delete('/api/meals/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM meals WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete meal' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Meal not found' });
    }
    
    res.json({ message: 'Meal deleted successfully' });
  });
});

// Foods routes
app.get('/api/foods', authenticateToken, (req, res) => {
  const { search, type } = req.query;
  let query = `
    SELECT f.*, COALESCE(ufo.active, f.active) AS active
    FROM foods f
    LEFT JOIN user_food_overrides ufo ON ufo.food_id = f.id AND ufo.user_id = ?
    WHERE (f.user_id = ? OR f.user_id IS NULL)
  `;
  let params = [req.user.userId, req.user.userId];
  
  if (search) {
    query += ' AND f.name LIKE ?';
    params.push(`%${search}%`);
  }
  
  if (type === 'user') {
    query += ' AND f.user_id = ?';
    params.push(req.user.userId);
  } else if (type === 'common') {
    query += ' AND f.user_id IS NULL';
  }
  
  query += ' ORDER BY f.name';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/foods', authenticateToken, (req, res) => {
  const { name, brand, serving_size, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, fiber_per_serving } = req.body;
  const isMissing = (v) => v === undefined || v === null || v === '';
  
  if (!name || !serving_size || isMissing(calories_per_serving) || isMissing(protein_per_serving) || isMissing(carbs_per_serving) || isMissing(fat_per_serving)) {
    return res.status(400).json({ error: 'All nutrition fields are required' });
  }

  db.run('INSERT INTO foods (user_id, name, brand, serving_size, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, fiber_per_serving) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.userId, name, brand, serving_size, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, fiber_per_serving || 0], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to create food' });
    }
    
    res.status(201).json({
      message: 'Food created successfully',
      food: {
        id: this.lastID,
        user_id: req.user.userId,
        name,
        brand,
        serving_size,
        calories_per_serving,
        protein_per_serving,
        carbs_per_serving,
        fat_per_serving,
        fiber_per_serving: fiber_per_serving || 0
      }
    });
  });
});

app.put('/api/foods/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, brand, serving_size, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, fiber_per_serving } = req.body;
  const isMissing = (v) => v === undefined || v === null || v === '';
  
  if (!name || !serving_size || isMissing(calories_per_serving) || isMissing(protein_per_serving) || isMissing(carbs_per_serving) || isMissing(fat_per_serving)) {
    return res.status(400).json({ error: 'All nutrition fields are required' });
  }

  // First verify the food belongs to the user (can't edit common foods)
  db.get('SELECT * FROM foods WHERE id = ? AND user_id = ?', [id, req.user.userId], (err, food) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!food) {
      return res.status(404).json({ error: 'Food not found or you do not have permission to edit it' });
    }

    db.run('UPDATE foods SET name = ?, brand = ?, serving_size = ?, calories_per_serving = ?, protein_per_serving = ?, carbs_per_serving = ?, fat_per_serving = ?, fiber_per_serving = ? WHERE id = ? AND user_id = ?',
      [name, brand, serving_size, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, fiber_per_serving || 0, id, req.user.userId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update food' });
      }
      
      res.json({
        message: 'Food updated successfully',
        food: {
          id: parseInt(id),
          user_id: req.user.userId,
          name,
          brand,
          serving_size,
          calories_per_serving,
          protein_per_serving,
          carbs_per_serving,
          fat_per_serving,
          fiber_per_serving: fiber_per_serving || 0
        }
      });
    });
  });
});

// Toggle food active status (user-owned updates in foods, common via per-user override)
app.put('/api/foods/:id/toggle', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get('SELECT id, user_id, active, is_common FROM foods WHERE id = ?', [id], (err, food) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!food) {
      return res.status(404).json({ error: 'Food not found' });
    }

    const isOwner = food.user_id === req.user.userId;
    const isCommon = food.user_id === null || food.is_common;

    // User-owned: flip directly on foods table
    if (isOwner) {
      const newActive = food.active ? 0 : 1;
      db.run('UPDATE foods SET active = ? WHERE id = ? AND user_id = ?', [newActive, id, req.user.userId], function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Failed to update food status' });
        }
        return res.json({ message: 'Food status updated successfully', active: !!newActive });
      });
      return;
    }

    // Common food: upsert per-user override
    if (isCommon) {
      db.get('SELECT id, active FROM user_food_overrides WHERE user_id = ? AND food_id = ?', [req.user.userId, id], (ovErr, override) => {
        if (ovErr) {
          return res.status(500).json({ error: 'Database error' });
        }

        const effectiveActive = override ? override.active : (food.active ?? 1);
        const newActive = effectiveActive ? 0 : 1;
        const upsertSql = `
          INSERT INTO user_food_overrides (user_id, food_id, active)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id, food_id) DO UPDATE SET active = excluded.active, created_at = CURRENT_TIMESTAMP
        `;

        db.run(upsertSql, [req.user.userId, id, newActive], function(upsertErr) {
          if (upsertErr) {
            return res.status(500).json({ error: 'Failed to update food status' });
          }
          return res.json({ message: 'Food status updated successfully', active: !!newActive });
        });
      });
      return;
    }

    // Food belongs to another user
    return res.status(403).json({ error: 'You do not have permission to edit this food' });
  });
});

// Parse nutrition label image with AI (prefers Ollama vision, falls back to OpenAI vision)
app.post('/api/foods/label/parse', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const { name = '', brand = '' } = req.body;

    // Load AI config
    const config = await new Promise((resolve) => {
      db.get('SELECT * FROM ai_config WHERE user_id = ?', [req.user.userId], (err, row) => resolve(row));
    });

    // Local timeout helper (default 60s)
    const fetchWithTimeout = (url, options, timeout = 60000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(id));
    };

    const base64Image = req.file.buffer.toString('base64');
    const systemPrompt = 'You are an assistant that reads nutrition labels. Return ONLY a JSON object with numeric fields. Use TOTAL fat (not saturated or trans) and TOTAL carbohydrates even if labeled as total carb/carbohydrate. If dietary fiber is missing, set fiber_per_serving to 0.';
    const userPrompt = `Extract nutrition facts from this nutrition label image. Use numbers only.  The data will be in a tabular format.  Only take the columns labeled per serving, not per container or total.  The rows will be such as Total Fat, saturated fat, trans fat, cholesterol, sodium, total carbohydrate, dietary fiber, total sugars, added sugars, protein, vitamins and minerals.  Ignore vitamins and minerals.
  Map the values in the approporiate rows based on the names above to the following return fields: serving_size (string), calories_per_serving (number), protein_per_serving (number), carbs_per_serving (number, use TOTAL carbs even if abbreviated), fat_per_serving (number, use TOTAL fat), fiber_per_serving (number, 0 if missing), notes (string, optional).
  Food name: ${name || 'unknown'}
  Brand: ${brand || 'unknown'}`;

    let content = '';

    // Helpers to call providers
    const tryOllama = async () => {
      if (!(config && config.ollama_enabled && config.ollama_endpoint && config.ollama_model)) {
        throw new Error('Ollama not fully configured');
      }
      const ollamaRes = await fetchWithTimeout(`${config.ollama_endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.ollama_model,
          prompt: `${systemPrompt}\n\n${userPrompt}`,
          images: [base64Image],
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 512
          }
        })
      });
      if (!ollamaRes.ok) {
        throw new Error('Ollama API error while parsing label');
      }
      const ollamaData = await ollamaRes.json();
      return ollamaData.response || '';
    };

    const tryOpenAI = async () => {
      if (!(config && config.openai_enabled && config.openai_api_key && config.openai_model)) {
        throw new Error('OpenAI not fully configured');
      }
      const openaiRes = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openai_api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.openai_model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                { type: 'image_url', image_url: { url: `data:${req.file.mimetype};base64,${base64Image}` } }
              ]
            }
          ],
          temperature: 0.1,
          // Avoid response_format to increase model compatibility
          max_tokens: 500
        })
      });
      if (!openaiRes.ok) {
        throw new Error('OpenAI API error while parsing label');
      }
      const openaiData = await openaiRes.json();
      return openaiData.choices?.[0]?.message?.content || '';
    };

    // Choose primary service based on preferred_service, else default
    const primaryService = (config && config.preferred_service) 
      ? config.preferred_service 
      : (config && config.openai_enabled ? 'openai' : (config && config.ollama_enabled ? 'ollama' : null));

    if (!primaryService) {
      return res.status(400).json({ error: 'AI service not configured. Enable OpenAI or Ollama in AI Configuration.' });
    }

    try {
      content = primaryService === 'ollama' ? await tryOllama() : await tryOpenAI();
    } catch (primaryErr) {
      // Attempt fallback to the other provider if possible
      try {
        const fallbackService = primaryService === 'ollama' ? 'openai' : 'ollama';
        if (fallbackService === 'ollama' && config && config.ollama_enabled) {
          content = await tryOllama();
        } else if (fallbackService === 'openai' && config && config.openai_enabled) {
          content = await tryOpenAI();
        } else {
          throw primaryErr;
        }
      } catch (fallbackErr) {
        return res.status(502).json({ error: fallbackErr.message || 'AI parsing failed', details: primaryErr.message });
      }
    }

    let parsed;
    try {
      let cleaned = (content || '').trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/,'').replace(/```$/,'').trim();
      }
      parsed = JSON.parse(cleaned);
    } catch (_e) {
      return res.status(502).json({ error: 'Failed to parse AI response', raw: content });
    }

    const toNumberOrZero = (val) => {
      if (val === undefined || val === null) return 0;
      if (typeof val === 'string' && val.trim() === '') return 0;
      const num = Number(val);
      return Number.isFinite(num) ? num : 0;
    };

    const fields = {
      serving_size: parsed.serving_size || '',
      calories_per_serving: toNumberOrZero(parsed.calories_per_serving),
      protein_per_serving: toNumberOrZero(parsed.protein_per_serving),
      carbs_per_serving: toNumberOrZero(parsed.carbs_per_serving),
      fat_per_serving: toNumberOrZero(parsed.fat_per_serving),
      fiber_per_serving: toNumberOrZero(parsed.fiber_per_serving)
    };

    return res.json({ fields, raw_response: content });
  } catch (err) {
    console.error('Label parse error:', err);
    return res.status(500).json({ error: 'Failed to parse nutrition label' });
  }
});

app.delete('/api/foods/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  // First verify the food belongs to the user (can't delete common foods)
  db.get('SELECT * FROM foods WHERE id = ? AND user_id = ?', [id, req.user.userId], (err, food) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!food) {
      return res.status(404).json({ error: 'Food not found or you do not have permission to delete it' });
    }

    db.run('DELETE FROM foods WHERE id = ? AND user_id = ?', [id, req.user.userId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete food' });
      }
      
      res.json({ message: 'Food deleted successfully' });
    });
  });
});

// Meal plans routes
  app.get('/api/meal-plans', authenticateToken, (req, res) => {
  const { date } = req.query;
  let query = `
    SELECT mp.*, m.name as meal_name, m.type as meal_type, f.name as food_name, f.serving_size, 
           f.calories_per_serving, f.protein_per_serving, f.carbs_per_serving, f.fat_per_serving, f.fiber_per_serving
    FROM meal_plans mp
    JOIN meals m ON mp.meal_id = m.id
    LEFT JOIN foods f ON mp.food_id = f.id
    WHERE mp.user_id = ?
  `;
  let params = [req.user.userId];
  
  if (date) {
    query += ' AND mp.date = ?';
    params.push(date);
  }
  
  query += ' ORDER BY m.time_start';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/meal-plans', authenticateToken, (req, res) => {
  const { date, meal_id, food_id, quantity } = req.body;
  
  if (!date || !meal_id || !food_id || !quantity) {
    return res.status(400).json({ error: 'Date, meal_id, food_id, and quantity are required' });
  }

  db.run('INSERT INTO meal_plans (user_id, date, meal_id, food_id, quantity) VALUES (?, ?, ?, ?, ?)',
    [req.user.userId, date, meal_id, food_id, quantity], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to create meal plan' });
    }
    
    res.status(201).json({
      message: 'Meal plan created successfully',
      meal_plan: {
        id: this.lastID,
        user_id: req.user.userId,
        date,
        meal_id,
        food_id,
        quantity
      }
    });
  });
});

// Add linked food to meal by expanding components
app.post('/api/meal-plans/add-linked', authenticateToken, (req, res) => {
  const { date, meal_id, linked_food_id, quantity } = req.body;
  if (!date || !meal_id || !linked_food_id || !quantity) {
    return res.status(400).json({ error: 'Date, meal_id, linked_food_id, and quantity are required' });
  }

  db.all(`
    SELECT lfc.food_id, lfc.quantity AS component_qty
    FROM linked_food_components lfc
    JOIN linked_foods lf ON lfc.linked_food_id = lf.id
    WHERE lf.id = ? AND lf.user_id = ?
  `, [linked_food_id, req.user.userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Linked food not found' });
    }

    db.serialize(() => {
      const stmt = db.prepare('INSERT INTO meal_plans (user_id, date, meal_id, food_id, quantity) VALUES (?, ?, ?, ?, ?)');
      try {
        rows.forEach(row => {
          const q = row.component_qty * quantity;
          stmt.run(req.user.userId, date, meal_id, row.food_id, q);
        });
        stmt.finalize(err2 => {
          if (err2) return res.status(500).json({ error: 'Failed to add linked food components' });
          res.status(201).json({ message: 'Linked food added to meal successfully' });
        });
      } catch (e) {
        stmt.finalize(() => {});
        return res.status(500).json({ error: 'Failed to add linked food components' });
      }
    });
  });
});

// Update meal plan quantity
app.put('/api/meal-plans/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (quantity === undefined || quantity < 0.5) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  db.run('UPDATE meal_plans SET quantity = ? WHERE id = ? AND user_id = ?', [quantity, id, req.user.userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to update meal plan' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    res.json({ message: 'Meal plan updated successfully' });
  });
});

// Move food between meals
app.post('/api/meal-plans/:id/move', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { newMealId } = req.body;

  if (!newMealId) {
    return res.status(400).json({ error: 'New meal ID is required' });
  }

  db.run('UPDATE meal_plans SET meal_id = ? WHERE id = ? AND user_id = ?', [newMealId, id, req.user.userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to move meal plan' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    res.json({ message: 'Food moved to meal successfully' });
  });
});

app.delete('/api/meal-plans/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM meal_plans WHERE id = ? AND user_id = ?', [id, req.user.userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete meal plan' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }
    
    res.json({ message: 'Meal plan deleted successfully' });
  });
});

// Linked Foods routes
  app.get('/api/linked-foods', authenticateToken, (req, res) => {
    db.all(`
      SELECT lf.*, 
             GROUP_CONCAT(
               json_object('id', f.id, 'name', f.name, 'quantity', lfc.quantity, 
                          'calories_per_serving', f.calories_per_serving,
                          'protein_per_serving', f.protein_per_serving,
                          'carbs_per_serving', f.carbs_per_serving,
                          'fat_per_serving', f.fat_per_serving)
             ) as components
      FROM linked_foods lf
      LEFT JOIN linked_food_components lfc ON lf.id = lfc.linked_food_id
      LEFT JOIN foods f ON lfc.food_id = f.id
      WHERE lf.user_id = ?
      GROUP BY lf.id
      ORDER BY lf.created_at DESC
    `, [req.user.userId], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      const linkedFoods = rows.map(row => ({
        ...row,
        components: row.components ? JSON.parse(`[${row.components}]`) : []
      }));
      
      res.json(linkedFoods);
    });
  });

    app.post('/api/linked-foods', authenticateToken, (req, res) => {
      const { name, description, components } = req.body;
      
      if (!name || !components || components.length === 0) {
        return res.status(400).json({ error: 'Name and at least one component are required' });
      }

      db.serialize(() => {
        db.run('INSERT INTO linked_foods (user_id, name, description) VALUES (?, ?, ?)'
          , [req.user.userId, name, description], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create linked food' });
          }
          
          const linkedFoodId = this.lastID;
          
          // Insert components
          const componentPromises = components.map(component => {
            return new Promise((resolve, reject) => {
              db.run('INSERT INTO linked_food_components (linked_food_id, food_id, quantity) VALUES (?, ?, ?)'
                , [linkedFoodId, component.food_id, component.quantity], function(err) {
                if (err) reject(err);
                else resolve();
              });
            });
          });
          
          Promise.all(componentPromises)
            .then(() => {
              res.status(201).json({
                message: 'Linked food created successfully',
                linked_food: {
                  id: linkedFoodId,
                  user_id: req.user.userId,
                  name,
                  description,
                  components
                }
              });
            })
            .catch(err => {
              res.status(500).json({ error: 'Failed to add components' });
            });
        });
      });
    });

  app.get('/api/linked-foods/:id/nutrition', authenticateToken, (req, res) => {
    
    db.all(`
      SELECT f.*, lfc.quantity
      FROM linked_food_components lfc
      JOIN foods f ON lfc.food_id = f.id
      JOIN linked_foods lf ON lfc.linked_food_id = lf.id
      WHERE lfc.linked_food_id = ? AND lf.user_id = ?
    `, [req.params.id, req.user.userId], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Linked food not found' });
      }
      
      const nutrition = rows.reduce((acc, row) => {
        const multiplier = row.quantity;
        acc.calories += (row.calories_per_serving || 0) * multiplier;
        acc.protein += (row.protein_per_serving || 0) * multiplier;
        acc.carbs += (row.carbs_per_serving || 0) * multiplier;
        acc.fat += (row.fat_per_serving || 0) * multiplier;
        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
      
      res.json({
        linked_food_id: parseInt(req.params.id),
        nutrition: {
          calories: Math.round(nutrition.calories),
          protein: Math.round(nutrition.protein * 10) / 10,
          carbs: Math.round(nutrition.carbs * 10) / 10,
          fat: Math.round(nutrition.fat * 10) / 10
        },
        components: rows.map(row => ({
          food_id: row.id,
          name: row.name,
          quantity: row.quantity,
          nutrition: {
            calories: (row.calories_per_serving || 0) * row.quantity,
            protein: (row.protein_per_serving || 0) * row.quantity,
            carbs: (row.carbs_per_serving || 0) * row.quantity,
            fat: (row.fat_per_serving || 0) * row.quantity
          }
        }))
      });
    });
  });

  // AI Service Configuration routes
  app.get('/api/ai-config', authenticateToken, (req, res) => {
    db.get('SELECT * FROM ai_config WHERE user_id = ?', [req.user.userId], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!row) {
        // Return default config
        return res.json({
          openai_enabled: false,
          openai_api_key: '',
          openai_model: '',
          ollama_enabled: false,
          ollama_endpoint: 'http://localhost:11434',
          ollama_model: '',
          preferred_service: null
        });
      }
      
      res.json({
        openai_enabled: !!row.openai_enabled,
        openai_api_key: row.openai_api_key || '',
        openai_model: row.openai_model || '',
        ollama_enabled: !!row.ollama_enabled,
        ollama_endpoint: row.ollama_endpoint || 'http://localhost:11434',
        ollama_model: row.ollama_model || '',
        preferred_service: row.preferred_service
      });
    });
  });

  app.post('/api/ai-config', authenticateToken, (req, res) => {
    const { 
      openai_enabled, 
      openai_api_key,
      openai_model, 
      ollama_enabled, 
      ollama_endpoint, 
      ollama_model, 
      preferred_service 
    } = req.body;

    db.get('SELECT id FROM ai_config WHERE user_id = ?', [req.user.userId], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const configData = {
        openai_enabled: openai_enabled ? 1 : 0,
        openai_api_key: openai_api_key || '',
        openai_model: openai_model || '',
        ollama_enabled: ollama_enabled ? 1 : 0,
        ollama_endpoint: ollama_endpoint || 'http://localhost:11434',
        ollama_model: ollama_model || '',
        preferred_service: preferred_service || null
      };

      if (row) {
        // Update existing config
        const updateFields = Object.keys(configData).map(key => `${key} = ?`).join(', ');
        const updateValues = Object.values(configData);
        updateValues.push(req.user.userId);

        db.run(`UPDATE ai_config SET ${updateFields} WHERE user_id = ?`, updateValues, function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to update AI config' });
          }
          
          res.json({
            message: 'AI configuration updated successfully',
            config: configData
          });
        });
      } else {
        // Insert new config
        const insertFields = Object.keys(configData).join(', ');
        const insertPlaceholders = Object.keys(configData).map(() => '?').join(', ');
        const insertValues = [req.user.userId, ...Object.values(configData)];

        db.run(`INSERT INTO ai_config (user_id, ${insertFields}) VALUES (?, ${insertPlaceholders})`, 
          insertValues, function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to save AI config' });
          }
          
          res.status(201).json({
            message: 'AI configuration saved successfully',
            config: configData
          });
        });
      }
    });
  });

app.get('/api/ai-models', authenticateToken, async (req, res) => {
    try {
      // Get user's AI config
      db.get('SELECT * FROM ai_config WHERE user_id = ?', [req.user.userId], async (err, config) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        const models = {
          openai: [],
          ollama: []
        };

        // Fetch OpenAI models if configured
        if (config && config.openai_enabled && config.openai_api_key) {
          try {
            const openaiResponse = await fetch('https://api.openai.com/v1/models', {
              headers: {
                'Authorization': `Bearer ${config.openai_api_key}`
              }
            });

            if (openaiResponse.ok) {
              const openaiData = await openaiResponse.json();
              models.openai = openaiData.data
                .filter(model => model.id.includes('gpt'))
                .map(model => ({
                  id: model.id,
                  name: model.id,
                  provider: 'openai'
                }));
            }
          } catch (error) {
            console.error('Failed to fetch OpenAI models:', error);
          }
        }

        // Fetch Ollama models if configured
        if (config && config.ollama_enabled && config.ollama_endpoint) {
          try {
            const ollamaResponse = await fetch(`${config.ollama_endpoint}/api/tags`);

            if (ollamaResponse.ok) {
              const ollamaData = await ollamaResponse.json();
              models.ollama = ollamaData.models.map(model => ({
                id: model.name,
                name: `${model.name} (${model.size || 'Unknown size'})`,
                provider: 'ollama'
              }));
            }
          } catch (error) {
            console.error('Failed to fetch Ollama models:', error);
          }
        }

        res.json(models);
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch AI models' });
    }
  });

// AI Suggestion endpoint (supports meal planning and single-item suggestions)
app.post('/api/ai/suggest', authenticateToken, (req, res) => {
  const { meal_id, target_calories, preferences, date, allow_new_foods, mode, exclude_food_ids } = req.body;
  const suggestionMode = mode || 'meal'; // 'meal' or 'single-item'

  if (!meal_id || !target_calories) {
    return res.status(400).json({ error: 'meal_id and target_calories are required' });
  }

  // Generate unique request ID
  const requestId = generateRequestId();
  aiRequests[requestId] = {
    status: 'queued',
    suggestions: null,
    error: null,
    createdAt: Date.now(),
    mealId: meal_id,
    userId: req.user.userId
  };
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send request ID immediately so frontend can track it
  sendEvent({ requestId, status: 'queued' });
  // Helper function to get all user data
  const getUserData = () => {
    return new Promise((resolve) => {
      Promise.all([
        new Promise(resolve => {
          db.get('SELECT * FROM user_macro_goals WHERE user_id = ? AND is_active = 1', 
            [req.user.userId], (err, row) => resolve(row));
        }),
        new Promise(resolve => {
          db.get('SELECT * FROM meals WHERE id = ? AND user_id = ?', 
            [meal_id, req.user.userId], (err, row) => resolve(row));
        }),
        new Promise(resolve => {
          db.all('SELECT * FROM meals WHERE user_id = ? ORDER BY time_start', 
            [req.user.userId], (err, rows) => resolve(rows || []));
        }),
        new Promise(resolve => {
          db.all(`
            SELECT f.*, COALESCE(ufo.active, f.active) AS active
            FROM foods f
            LEFT JOIN user_food_overrides ufo ON ufo.food_id = f.id AND ufo.user_id = ?
            WHERE (f.user_id = ? OR f.user_id IS NULL)
              AND COALESCE(ufo.active, f.active) = 1
            LIMIT 200
          `, [req.user.userId, req.user.userId], (err, rows) => resolve(rows || []));
        }),
        new Promise(resolve => {
          db.all(`SELECT lf.id, lf.name, 
                  SUM(f.calories_per_serving * lfc.quantity) as calories_per_serving,
                  SUM(f.protein_per_serving * lfc.quantity) as protein_per_serving,
                  SUM(f.carbs_per_serving * lfc.quantity) as carbs_per_serving,
                  SUM(f.fat_per_serving * lfc.quantity) as fat_per_serving,
                  SUM(f.fiber_per_serving * lfc.quantity) as fiber_per_serving
            FROM linked_foods lf
            LEFT JOIN linked_food_components lfc ON lf.id = lfc.linked_food_id
            LEFT JOIN foods f ON lfc.food_id = f.id
            WHERE lf.user_id = ?
            GROUP BY lf.id
            LIMIT 100`,
            [req.user.userId], (err, rows) => resolve(rows || []));
        }),
        new Promise(resolve => {
          const useDate = date || new Date().toISOString().split('T')[0];
          db.all(`
            SELECT mp.*, f.name as food_name, f.serving_size,
                   f.calories_per_serving, f.protein_per_serving, f.carbs_per_serving, f.fat_per_serving, f.fiber_per_serving
            FROM meal_plans mp
            JOIN meals m ON mp.meal_id = m.id
            LEFT JOIN foods f ON mp.food_id = f.id
            WHERE mp.user_id = ? AND mp.date = ?
          `, [req.user.userId, useDate], (err, rows) => resolve(rows || []));
        }),
        new Promise(resolve => {
          const useDate = date || new Date().toISOString().split('T')[0];
          db.all(`
            SELECT DISTINCT mp.food_id, f.name
            FROM meal_plans mp
            LEFT JOIN foods f ON mp.food_id = f.id
            WHERE mp.user_id = ? AND mp.date = ? AND mp.food_id IS NOT NULL
          `, [req.user.userId, useDate], (err, rows) => resolve(rows || []));
        })
      ]).then(([goals, meal, allMeals, foods, linkedFoods, dayPlans, foodsEatenToday]) => {
        resolve({ goals, meal, allMeals, foods, linkedFoods, dayPlans, foodsEatenToday });
      });
    });
  };

  (async () => {
    try {
      sendEvent({ status: 'Fetching user data...' });
      
      const { goals, meal, allMeals, foods, linkedFoods, dayPlans, foodsEatenToday } = await getUserData();

      if (!goals) {
        sendEvent({ error: 'No macro goals configured. Please set your macro goals first.' });
        res.end();
        return;
      }

      if (!meal) {
        sendEvent({ error: 'Meal not found.' });
        res.end();
        return;
      }

      sendEvent({ status: 'Building food list...' });

      // Format foods for AI (trimmed to reduce prompt size)
      const foodsList = foods.map(f => ({
        id: f.id,
        name: f.name,
        calories: Math.round(f.calories_per_serving || 0),
        protein: parseFloat((f.protein_per_serving || 0).toFixed(1)),
        carbs: parseFloat((f.carbs_per_serving || 0).toFixed(1)),
        fat: parseFloat((f.fat_per_serving || 0).toFixed(1)),
        fiber: parseFloat((f.fiber_per_serving || 0).toFixed(1))
      }));

      const linkedFoodsList = linkedFoods.map(lf => ({
        id: `linked_${lf.id}`,
        name: lf.name,
        calories: Math.round(lf.calories_per_serving || 0),
        protein: parseFloat(((lf.protein_per_serving || 0)).toFixed(1)),
        carbs: parseFloat(((lf.carbs_per_serving || 0)).toFixed(1)),
        fat: parseFloat(((lf.fat_per_serving || 0)).toFixed(1)),
        fiber: parseFloat(((lf.fiber_per_serving || 0)).toFixed(1))
      }));

      const allFoods = [...foodsList, ...linkedFoodsList];

      // Summarize current day and meal context
      const useDate = date || new Date().toISOString().split('T')[0];
      const currentMealPlans = (dayPlans || []).filter(p => p.meal_id === meal_id);
      const otherMealsPlans = (dayPlans || []).filter(p => p.meal_id !== meal_id);

      const summarizeItems = (plans) => plans.map(p => ({
        food_id: p.food_id,
        name: p.food_name,
        quantity: p.quantity,
        calories: Math.round((p.calories_per_serving || 0) * p.quantity),
        protein: parseFloat(((p.protein_per_serving || 0) * p.quantity).toFixed(1)),
        carbs: parseFloat(((p.carbs_per_serving || 0) * p.quantity).toFixed(1)),
        fat: parseFloat(((p.fat_per_serving || 0) * p.quantity).toFixed(1)),
        fiber: parseFloat(((p.fiber_per_serving || 0) * p.quantity).toFixed(1))
      }));

      const dayTotals = (dayPlans || []).reduce((acc, p) => {
        acc.calories += (p.calories_per_serving || 0) * p.quantity;
        acc.protein += (p.protein_per_serving || 0) * p.quantity;
        acc.carbs += (p.carbs_per_serving || 0) * p.quantity;
        acc.fat += (p.fat_per_serving || 0) * p.quantity;
        acc.fiber += (p.fiber_per_serving || 0) * p.quantity;
        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

      if (allFoods.length === 0) {
        sendEvent({ error: 'No foods available. Please add foods to your catalog first.' });
        res.end();
        return;
      }

      sendEvent({ status: 'Contacting AI service...' });

      // Get AI config
      db.get('SELECT * FROM ai_config WHERE user_id = ?', [req.user.userId], async (err, config) => {
        if (err || !config || (!config.openai_enabled && !config.ollama_enabled)) {
          sendEvent({ error: 'AI service not configured. Please configure OpenAI or Ollama in AI Configuration.' });
          res.end();
          return;
        }

  aiRequests[requestId].status = 'contacting_ai_provider';
  sendEvent({ requestId, status: 'contacting_ai_provider' });
        const service = config.preferred_service || (config.openai_enabled ? 'openai' : 'ollama');
        
        // List foods already eaten today for variety
        const foodsEatenIds = (foodsEatenToday || []).map(f => f.food_id).filter(Boolean);
        const foodsEatenList = (foodsEatenToday || [])
          .map(f => f.name && f.food_id ? `${f.name} (ID: ${f.food_id})` : null)
          .filter(Boolean)
          .join(', ');
        const foodsEatenIdString = foodsEatenIds.join(', ') || 'none';
        
        // Calculate macro remainders explicitly for the prompt
        // If track_net_carbs is enabled, subtract fiber from carbs to get net carbs
        const dayTotalsForMacros = { ...dayTotals };
        if (goals.track_net_carbs) {
          dayTotalsForMacros.carbs = Math.max(0, dayTotals.carbs - dayTotals.fiber);
        }

        const dailyRemaining = {
          calories: Math.max(0, goals.calories - dayTotals.calories),
          protein: Math.max(0, goals.protein - dayTotals.protein),
          carbs: Math.max(0, goals.carbs - dayTotalsForMacros.carbs),
          fat: Math.max(0, goals.fat - dayTotals.fat),
          fiber: Math.max(0, (goals.fiber || 0) - dayTotals.fiber)
        };

        const currentMealTotals = currentMealPlans.reduce((acc, p) => {
          acc.calories += (p.calories_per_serving || 0) * p.quantity;
          acc.protein += (p.protein_per_serving || 0) * p.quantity;
          acc.carbs += (p.carbs_per_serving || 0) * p.quantity;
          acc.fat += (p.fat_per_serving || 0) * p.quantity;
          acc.fiber += (p.fiber_per_serving || 0) * p.quantity;
          return acc;
        }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

        const mealRemaining = {
          calories: Math.max(0, target_calories - currentMealTotals.calories),
          protein: Math.max(0, (target_calories / goals.calories * goals.protein) - currentMealTotals.protein),
          carbs: Math.max(0, (target_calories / goals.calories * goals.carbs) - currentMealTotals.carbs),
          fat: Math.max(0, (target_calories / goals.calories * goals.fat) - currentMealTotals.fat),
          fiber: Math.max(0, (target_calories / goals.calories * (goals.fiber || 0)) - currentMealTotals.fiber)
        };

        const maxAdditional = {
          // Only constrain calories per meal - other macros track daily across all meals
          calories: Math.min(dailyRemaining.calories, mealRemaining.calories),
          protein: dailyRemaining.protein,  // Use daily remaining, not meal-specific
          carbs: dailyRemaining.carbs,      // Use daily remaining, not meal-specific
          fat: dailyRemaining.fat,          // Use daily remaining, not meal-specific
          fiber: dailyRemaining.fiber       // Use daily remaining, not meal-specific
        };
        
        // PRE-FILTER available foods based on hard macro constraints
        // Only send foods that can actually be suggested given the current macro state
        let viableFoods = (allFoods || []).filter(food => {
          // Exclude foods already in this meal
          const inCurrentMeal = currentMealPlans.some(p => p.food_id === food.id);
          if (inCurrentMeal) return false;
          
          // Exclude foods in the "avoid for variety" list
          if (foodsEatenIds.includes(food.id)) return false;
          
          // Exclude invalid/broken foods (like linked_1 with all zeros)
          if (!food.id || food.id === 'linked_1' || food.calories === 0) return false;
          
          // Filter by DAILY remaining macros (not per-meal constraints)
          // Since AI can only suggest whole servings (1, 2, 3), exclude foods where 1 serving exceeds remaining limits
          if (food.carbs > dailyRemaining.carbs) return false;
          if (food.fat > dailyRemaining.fat) return false;
          if (dailyRemaining.fiber <= 0 && food.fiber > 0.5) return false;
          
          return true;
        });
        
        // LIMIT foods sent to AI to prevent prompt overflow
        // Score foods by relevance: prioritize good calorie fit and high protein
        viableFoods = viableFoods
          .map(f => {
            const calorieFit = 1 - Math.abs(f.calories - (target_calories / 3)) / target_calories;
            const proteinScore = (f.protein || 0) / Math.max(f.calories || 1, 1) * 100;
            return { ...f, _score: calorieFit + proteinScore };
          })
          .sort((a, b) => b._score - a._score)
          .slice(0, 25) // Limit to top 25 foods
          .map(({ _score, ...f }) => ({
            id: f.id,
            name: f.name,
            calories: f.calories,
            protein: f.protein,
            carbs: f.carbs,
            fat: f.fat,
            fiber: f.fiber,
            serving: f.serving_size
          })); // Compact format - remove extra fields
        
        // Organize day breakdown by meal for context
        const dayBreakdown = (allMeals || []).map(m => {
          const mealItems = (dayPlans || []).filter(p => p.meal_id === m.id);
          if (mealItems.length === 0) return `${m.name}: (empty)`;
          const summary = mealItems.map(item => `${item.food_name} (${item.quantity}x, ~${Math.round((item.calories_per_serving || 0) * item.quantity)} cal)`).join(', ');
          return `${m.name}: ${summary}`;
        }).join('\n');
        
        // Build prompt based on mode
        let prompt;
        
        if (suggestionMode === 'single-item') {
          prompt = `Suggest 1 food for "${meal.name}" targeting ${target_calories} calories.

RESPOND WITH JSON ONLY:
{"suggested_foods": [{"food_id": <id>, "quantity": <number>, "reason": "<why>"}]}

RULES:
- quantity MUST be >= 1 (whole servings: 1, 2, 3). NO fractions like 0.5
- Use larger quantities (2-4 servings) to hit calorie target
- Pick from AVAILABLE FOODS only${allow_new_foods ? ' (or use is_new:true for new foods)' : ''}
${exclude_food_ids && exclude_food_ids.length > 0 ? `- DO NOT suggest these food IDs (already suggested): ${exclude_food_ids.join(', ')}\n` : ''}
- If impossible, return {"suggested_foods": []}

HARD LIMITS (do not exceed): ${Math.round(maxAdditional.calories)} cal, ${maxAdditional.carbs.toFixed(0)}g carbs, ${maxAdditional.fat.toFixed(0)}g fat
Protein and fiber can be exceeded - no limit on those.

AVAILABLE FOODS:
${JSON.stringify(viableFoods)}

JSON ONLY:`;
        } else {
          // 'meal' mode - suggest full meal
          const recommendedFoodCount = Math.max(2, Math.min(4, viableFoods.length + (allow_new_foods ? 2 : 0)));
          
          prompt = `Suggest ${recommendedFoodCount} foods for "${meal.name}" targeting ${target_calories} calories total.

RESPOND WITH JSON ONLY:
{"suggested_foods": [{"food_id": <id>, "quantity": <number>, "reason": "<why>"}, ...]}

RULES:
- quantity MUST be >= 1 (whole servings: 1, 2, 3). NO fractions
- CRITICAL: Calculate running total as you add foods. STOP at ${Math.round(target_calories * 0.85)}-${target_calories} cal.
- Each food's calories = (food.calories × quantity). Add them up. DO NOT exceed ${target_calories}.
- CRITICAL: Also track carbs and fat totals. DO NOT exceed daily remaining: ${dailyRemaining.carbs.toFixed(0)}g ${goals.track_net_carbs ? 'net ' : ''}carbs, ${dailyRemaining.fat.toFixed(0)}g fat.
- Each food's carbs = (food.carbs × quantity)${goals.track_net_carbs ? ' minus fiber' : ''}, fat = (food.fat × quantity). Add them up and check against daily limits.
- MEAL COMPOSITION (MANDATORY): You MUST include at least one core protein source (meat, fish, eggs, tofu, etc.) AND at least one vegetable or fruit. Do not suggest multiple proteins without complementary produce. Points will be deducted if you violate this rule.
- COMMON SENSE: Only suggest foods that would realistically be eaten together as a meal. Avoid pairing standalone ingredients (e.g., don't suggest "chicken breast + olive oil" - suggest complete dishes or logical sides like rice, salad, vegetables).
${exclude_food_ids && exclude_food_ids.length > 0 ? `- DO NOT suggest these food IDs (already suggested): ${exclude_food_ids.join(', ')}\n` : ''}
- If impossible, return {"suggested_foods": []}

HARD LIMITS (daily remaining - DO NOT EXCEED these totals for the entire day):
- Calories FOR THIS MEAL: ${Math.round(maxAdditional.calories)} cal
- Carbs (${goals.track_net_carbs ? 'net' : 'total'}) (daily remaining): ${dailyRemaining.carbs.toFixed(0)}g - DO NOT exceed this total across all meals today
- Fat (daily remaining): ${dailyRemaining.fat.toFixed(0)}g - DO NOT exceed this total across all meals today
- Protein: No limit (can exceed freely)
- Fiber: No limit (can exceed freely)

AVAILABLE FOODS:
${JSON.stringify(viableFoods)}

JSON ONLY:`;
        }

  // Log the exact prompt to console for debugging (clean format)
  console.log('\n=== OLLAMA PROMPT ===\n' + prompt + '\n=== END PROMPT ===\n');

  // Stream the exact prompt for debugging now that it's defined
  sendEvent({ debug_prompt: prompt });
  sendEvent({ status: 'Prompt ready' });

        try {
          // Shared timeout helper for AI providers
          const fetchWithTimeout = (url, options, timeout = 60000) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            return fetch(url, { ...options, signal: controller.signal })
              .finally(() => clearTimeout(id));
          };

          let aiResponse;

          if (service === 'openai' && config.openai_enabled && config.openai_api_key && config.openai_model) {
            sendEvent({ status: 'Using OpenAI service...' });
                        aiRequests[requestId].status = 'waiting_for_response';
                        sendEvent({ requestId, status: 'waiting_for_response' });
            
            let openaiRes;
            try {
              openaiRes = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${config.openai_api_key}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: config.openai_model,
                messages: [
                  { role: 'system', content: 'You MUST respond with a single valid JSON object only.' },
                  { role: 'user', content: prompt }
                ],
                // Some models enforce default temperature only; use 1 for compatibility
                temperature: 1
              })
              });

              if (openaiRes.ok) {
                const openaiData = await openaiRes.json();
                aiResponse = openaiData.choices[0]?.message?.content;
              } else {
                const errText = await openaiRes.text();
                throw new Error(`OpenAI API error: ${openaiRes.status} ${openaiRes.statusText} - ${errText}`);
              }
            } catch (openaiErr) {
              console.error('OpenAI call failed:', openaiErr);
              sendEvent({ error: `OpenAI call failed: ${openaiErr.message}` });
              // Fallback to Ollama if available
              if (config.ollama_enabled && config.ollama_endpoint && config.ollama_model) {
                sendEvent({ status: 'Falling back to Ollama...' });
                try {
                  const ollamaRes = await fetchWithTimeout(`${config.ollama_endpoint}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      model: config.ollama_model,
                      prompt: prompt,
                      stream: false,
                      options: {
                        num_predict: 512,
                        temperature: 0.2
                      }
                    })
                  }, 120000);

                  if (!ollamaRes.ok) {
                    const ollamaErrText = await ollamaRes.text();
                    throw new Error(`Ollama API error: ${ollamaRes.status} ${ollamaRes.statusText} - ${ollamaErrText}`);
                  }
                  const ollamaData = await ollamaRes.json();
                  aiResponse = ollamaData.response || '';
                  sendEvent({ raw_response: aiResponse });
                } catch (ollamaErr) {
                  console.error('Ollama fallback failed:', ollamaErr);
                  sendEvent({ error: `Ollama fallback failed: ${ollamaErr.message}` });
                  throw ollamaErr;
                }
              } else {
                throw openaiErr;
              }
            }
          } else if (service === 'ollama' && config.ollama_enabled && config.ollama_endpoint && config.ollama_model) {
            sendEvent({ status: 'Using Ollama service (streaming)...' });
            console.log('Ollama config - endpoint:', config.ollama_endpoint, 'model:', config.ollama_model);
            sendEvent({ status: `Using model: ${config.ollama_model}` });
            aiRequests[requestId].status = 'waiting_for_response';
            sendEvent({ requestId, status: 'waiting_for_response' });

            // Add timeout wrapper for Ollama requests (2 minutes max)
            const fetchWithTimeout = (url, options, timeout = 120000) => {
              return Promise.race([
                fetch(url, options),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Ollama request timeout (2 minutes)')), timeout)
                )
              ]);
            };

            const ollamaRes = await fetchWithTimeout(`${config.ollama_endpoint}/api/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: config.ollama_model,
                prompt: prompt,
                stream: false,  // Get full response at once instead of streaming
                options: {
                  num_predict: 512,
                  temperature: 0.2
                }
              })
            });

            if (!ollamaRes.ok) {
              throw new Error('Ollama API error');
            }

            // Get the full response (non-streaming)
            const ollamaData = await ollamaRes.json();
            aiResponse = ollamaData.response || '';
            console.log('Ollama raw response:', aiResponse);
            console.log('Ollama response length:', aiResponse.length);
            // Also stream the final raw response snapshot
            sendEvent({ raw_response: aiResponse });
          } else {
            sendEvent({ error: 'No valid AI service configured.' });
            res.end();
            return;
          }

          sendEvent({ status: 'Parsing AI response...' });

          // Stream raw AI response before parsing for debugging
          if (aiResponse) {
            sendEvent({ raw_response: aiResponse });
          }

          aiRequests[requestId].status = 'parsing_response';
          sendEvent({ requestId, status: 'parsing_response' });
          // Extract JSON from response
          const cleaned = aiResponse
            // strip common code fences if any
            .replace(/```json|```/g, '')
            // remove leading/trailing whitespace
            .trim();

          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            aiRequests[requestId].status = 'error';
            aiRequests[requestId].error = 'Failed to parse AI response. AI did not return valid JSON.';
            sendEvent({ requestId, status: 'error', error: aiRequests[requestId].error, raw_response: aiResponse });
            res.end();
            return;
          }

          let parsedResponse;
          try {
            parsedResponse = JSON.parse(jsonMatch[0]);
          } catch (e) {
            // Fallback: salvage id + quantity pairs from raw text when JSON is invalid/truncated
            const salvage = [];
            const itemRegex = /\{[^}]*?(?:"food_id"|"id")\s*:\s*"?(linked_\d+|\d+)"?[^}]*?"quantity"\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*[^}]*\}/g;
            let match;
            while ((match = itemRegex.exec(cleaned)) && salvage.length < 4) {
              salvage.push({ food_id: match[1], quantity: parseFloat(match[2]) });
            }
            if (salvage.length > 0) {
              parsedResponse = { suggested_foods: salvage };
            } else {
              aiRequests[requestId].status = 'error';
              aiRequests[requestId].error = `JSON parse error: ${e.message}`;
              sendEvent({ requestId, status: 'error', error: aiRequests[requestId].error, raw_response: aiResponse });
              res.end();
              return;
            }
          }

          // Normalize suggestions into expected shape and keys
          let suggestionsRaw = parsedResponse.suggested_foods || [];
          if (!Array.isArray(suggestionsRaw)) {
            suggestionsRaw = [];
          }

          let normalized = suggestionsRaw.map(item => {
            // New food suggestion
            if (item.is_new === true) {
              const quantity = typeof item.quantity === 'number' && isFinite(item.quantity) ? item.quantity : 1;
              const requiredKeys = ['name', 'serving_size', 'calories', 'protein', 'carbs', 'fat', 'fiber'];
              const hasAll = requiredKeys.every(k => item[k] !== undefined && item[k] !== null);
              if (!hasAll || !allow_new_foods) return null;
              return {
                is_new: true,
                quantity,
                reason: String(item.reason || ''),
                name: String(item.name),
                serving_size: String(item.serving_size),
                calories: Number(item.calories),
                protein: Number(item.protein),
                carbs: Number(item.carbs),
                fat: Number(item.fat),
                fiber: Number(item.fiber)
              };
            }
            // Existing inventory item
            const foodId = item.food_id ?? item.id ?? null;
            const quantity = typeof item.quantity === 'number' && isFinite(item.quantity)
              ? item.quantity
              : (Array.isArray(item.servings) && typeof item.servings[0]?.quantity === 'number'
                  ? item.servings[0].quantity
                  : 1);
            return foodId != null ? { food_id: foodId, quantity, reason: String(item.reason || '') } : null;
          }).filter(Boolean);

          if (normalized.length === 0) {
            // Deterministic fallback: pick best-fitting foods to hit calorie target without violating max macros
            const targetRangeLow = Math.max(400, Math.min(550, target_calories - 200));
            const targetRangeHigh = Math.min(maxAdditional.calories || target_calories, 700);
            let remainingCalories = Math.min(targetRangeHigh, target_calories);

            const excludeSet = new Set(exclude_food_ids || []);
            const currentMealFoodIds = new Set(currentMealPlans.map(p => p.food_id));
            const sortedFoods = viableFoods
              .filter(f => f && f.id && f.calories > 0 && !excludeSet.has(f.id) && !currentMealFoodIds.has(f.id))
              .sort((a, b) => (b.protein || 0) - (a.protein || 0) || (b.calories || 0) - (a.calories || 0));

            const fallback = [];
            for (const food of sortedFoods) {
              if (fallback.length >= 4) break;

              const qty = Math.max(1, Math.min(3, Math.floor(remainingCalories / Math.max(food.calories, 1)) || 1));
              const calories = (food.calories || 0) * qty;
              const carbs = (food.carbs || 0) * qty;
              const fat = (food.fat || 0) * qty;
              const fiber = (food.fiber || 0) * qty;

              // Check against daily remaining limits (not per-meal)
              // Use net carbs if track_net_carbs is enabled
              const carbsToCheck = goals.track_net_carbs ? Math.max(0, carbs - fiber) : carbs;
              if (calories > (maxAdditional.calories || target_calories)) continue;
              if (carbsToCheck > dailyRemaining.carbs) continue;
              if (fat > dailyRemaining.fat) continue;

              fallback.push({ food_id: food.id, quantity: qty });
              remainingCalories = Math.max(0, remainingCalories - calories);
            }

            if (fallback.length === 0 && sortedFoods.length > 0) {
              fallback.push({ food_id: sortedFoods[0].id, quantity: 1 });
            }

            if (fallback.length === 0) {
              aiRequests[requestId].status = 'error';
              aiRequests[requestId].error = 'AI returned no usable suggestions.';
              sendEvent({ requestId, status: 'error', error: aiRequests[requestId].error, raw_response: aiResponse });
              res.end();
              return;
            }

            // Use the fallback as the normalized suggestions
            normalized = fallback;
            console.log('Using fallback suggestions:', JSON.stringify(fallback));
          }

          // Post-process: Cap quantities if AI overshoots the calorie target
          // Calculate running total and reduce quantities as needed
          let runningCalories = 0;
          const cappedNormalized = [];
          for (const suggestion of normalized) {
            const idStr = suggestion.food_id?.toString() || '';
            let foodCaloriesPerServing = 0;
            
            if (suggestion.is_new) {
              foodCaloriesPerServing = suggestion.calories || 0;
            } else if (idStr.startsWith('linked_')) {
              const linkedId = parseInt(idStr.replace('linked_', ''), 10);
              const lf = linkedFoods.find(x => x.id === linkedId);
              foodCaloriesPerServing = lf?.calories_per_serving || 0;
            } else {
              const f = foods.find(x => x.id?.toString() === idStr);
              foodCaloriesPerServing = f?.calories_per_serving || 0;
            }
            
            // Calculate how many servings we can actually fit
            const remainingCalories = Math.max(0, target_calories - runningCalories);
            const maxServings = Math.max(1, Math.floor(remainingCalories / Math.max(foodCaloriesPerServing, 1)));
            const cappedQuantity = Math.min(suggestion.quantity, maxServings);
            
            // Only add if we have room
            if (runningCalories < target_calories * 1.1) {
              cappedNormalized.push({ ...suggestion, quantity: cappedQuantity });
              runningCalories += foodCaloriesPerServing * cappedQuantity;
            }
            
            // Stop if we've hit the target
            if (runningCalories >= target_calories * 0.95) break;
          }
          
          // Use capped suggestions, but if capping filtered everything out, use fallback
          if (cappedNormalized.length === 0) {
            console.log('Post-processing filtered all suggestions, using fallback instead');
            // Deterministic fallback: pick best-fitting foods to hit calorie target without violating max macros
            const targetRangeLow = Math.max(400, Math.min(550, target_calories - 200));
            const targetRangeHigh = Math.min(maxAdditional.calories || target_calories, 700);
            let remainingCalories = Math.min(targetRangeHigh, target_calories);

            const excludeSet = new Set(exclude_food_ids || []);
            const currentMealFoodIds = new Set(currentMealPlans.map(p => p.food_id));
            const sortedFoods = viableFoods
              .filter(f => f && f.id && f.calories > 0 && !excludeSet.has(f.id) && !currentMealFoodIds.has(f.id))
              .sort((a, b) => (b.protein || 0) - (a.protein || 0) || (b.calories || 0) - (a.calories || 0));

            const fallback = [];
            for (const food of sortedFoods) {
              if (fallback.length >= 4) break;

              const qty = Math.max(1, Math.min(3, Math.floor(remainingCalories / Math.max(food.calories, 1)) || 1));
              const calories = (food.calories || 0) * qty;
              const carbs = (food.carbs || 0) * qty;
              const fat = (food.fat || 0) * qty;
              const fiber = (food.fiber || 0) * qty;

              // Check against daily remaining limits (not per-meal)
              // Use net carbs if track_net_carbs is enabled
              const carbsToCheck = goals.track_net_carbs ? Math.max(0, carbs - fiber) : carbs;
              if (calories > (maxAdditional.calories || target_calories)) continue;
              if (carbsToCheck > dailyRemaining.carbs) continue;
              if (fat > dailyRemaining.fat) continue;

              fallback.push({ food_id: food.id, quantity: qty });
              remainingCalories = Math.max(0, remainingCalories - calories);
            }

            if (fallback.length === 0 && sortedFoods.length > 0) {
              fallback.push({ food_id: sortedFoods[0].id, quantity: 1 });
            }

            if (fallback.length === 0) {
              aiRequests[requestId].status = 'error';
              aiRequests[requestId].error = 'No usable suggestions available after filtering.';
              sendEvent({ requestId, status: 'error', error: aiRequests[requestId].error, raw_response: aiResponse });
              res.end();
              return;
            }

            normalized = fallback;
            console.log('Using fallback after post-processing filter:', JSON.stringify(fallback));
          } else {
            normalized = cappedNormalized;
          }

          // Enrich suggestions with full food data
          const enrichedSuggestions = normalized.map(suggestion => {
            if (suggestion.is_new) {
              return {
                is_new: true,
                food_id: null,
                quantity: suggestion.quantity,
                name: suggestion.name,
                serving_size: suggestion.serving_size,
                calories: Math.round(suggestion.calories * suggestion.quantity),
                protein: parseFloat((suggestion.protein * suggestion.quantity).toFixed(1)),
                carbs: parseFloat((suggestion.carbs * suggestion.quantity).toFixed(1)),
                fat: parseFloat((suggestion.fat * suggestion.quantity).toFixed(1)),
                fiber: parseFloat((suggestion.fiber * suggestion.quantity).toFixed(1)),
                reason: suggestion.reason || ''
              };
            }
            const idStr = suggestion.food_id.toString();
            if (idStr.startsWith('linked_')) {
              const linkedId = parseInt(idStr.replace('linked_', ''), 10);
              const lf = linkedFoods.find(x => x.id === linkedId);
              if (!lf) return null;
              return {
                food_id: suggestion.food_id,
                quantity: suggestion.quantity,
                name: lf.name,
                serving_size: '1 serving',
                calories: Math.round((lf.calories_per_serving || 0) * suggestion.quantity),
                protein: parseFloat(((lf.protein_per_serving || 0) * suggestion.quantity).toFixed(1)),
                carbs: parseFloat(((lf.carbs_per_serving || 0) * suggestion.quantity).toFixed(1)),
                fat: parseFloat(((lf.fat_per_serving || 0) * suggestion.quantity).toFixed(1)),
                fiber: parseFloat(((lf.fiber_per_serving || 0) * suggestion.quantity).toFixed(1)),
                reason: suggestion.reason || ''
              };
            } else {
              const f = foods.find(x => x.id.toString() === idStr);
              if (!f) return null;
              return {
                food_id: suggestion.food_id,
                quantity: suggestion.quantity,
                name: f.name,
                serving_size: f.serving_size,
                calories: Math.round((f.calories_per_serving || 0) * suggestion.quantity),
                protein: parseFloat(((f.protein_per_serving || 0) * suggestion.quantity).toFixed(1)),
                carbs: parseFloat(((f.carbs_per_serving || 0) * suggestion.quantity).toFixed(1)),
                fat: parseFloat(((f.fat_per_serving || 0) * suggestion.quantity).toFixed(1)),
                fiber: parseFloat(((f.fiber_per_serving || 0) * suggestion.quantity).toFixed(1)),
                reason: suggestion.reason || ''
              };
            }
          }).filter(item => item !== null);

          const totals = enrichedSuggestions.reduce((acc, item) => ({
            calories: acc.calories + item.calories,
            protein: acc.protein + item.protein,
            carbs: acc.carbs + item.carbs,
            fat: acc.fat + item.fat,
            fiber: acc.fiber + item.fiber
          }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

          sendEvent({ 
            status: 'complete', 
            suggestions: enrichedSuggestions,
            totals: {
              calories: Math.round(totals.calories),
              protein: parseFloat(totals.protein.toFixed(1)),
              carbs: parseFloat(totals.carbs.toFixed(1)),
              fat: parseFloat(totals.fat.toFixed(1)),
              fiber: parseFloat(totals.fiber.toFixed(1))
            }
          });
          
          // Store suggestions in tracking and send ready status
          aiRequests[requestId].status = 'ready';
          aiRequests[requestId].suggestions = {
            suggestions: enrichedSuggestions,
            totals: {
              calories: Math.round(totals.calories),
              protein: parseFloat(totals.protein.toFixed(1)),
              carbs: parseFloat(totals.carbs.toFixed(1)),
              fat: parseFloat(totals.fat.toFixed(1)),
              fiber: parseFloat(totals.fiber.toFixed(1))
            }
          };
            aiRequests[requestId].debugPrompt = prompt;
            aiRequests[requestId].rawResponse = aiResponse;
          
            sendEvent({ 
              requestId, 
              status: 'ready', 
              suggestions: enrichedSuggestions, 
              totals: aiRequests[requestId].suggestions.totals,
              debugPrompt: prompt,
              rawResponse: aiResponse
            });
        } catch (error) {
          console.error('AI error:', error);
          sendEvent({ error: `AI service error: ${error.message}` });
            aiRequests[requestId].status = 'error';
            aiRequests[requestId].error = error.message;
        }

        res.end();
      });
    } catch (error) {
      console.error('Meal planning error:', error);
      sendEvent({ error: `Error: ${error.message}` });
      res.end();
    }
  })();
});  
  
// Cancel an AI suggestion request
app.post('/api/ai/cancel/:requestId', authenticateToken, (req, res) => {
  const { requestId } = req.params;
  
  if (!aiRequests[requestId]) {
    return res.status(404).json({ error: 'Request not found' });
  }
  
  // Verify the request belongs to the current user
  if (aiRequests[requestId].userId !== req.user.userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  // Mark as cancelled
  aiRequests[requestId].status = 'cancelled';
  aiRequests[requestId].error = 'Request cancelled by user';
  
  res.json({ success: true, message: 'Request cancelled' });
});

// Get status of an AI suggestion request (for page refresh recovery)
app.get('/api/ai/status/:requestId', authenticateToken, (req, res) => {
  const { requestId } = req.params;
  
  if (!aiRequests[requestId]) {
    return res.status(404).json({ error: 'Request not found' });
  }
  
  // Verify the request belongs to the current user
  if (aiRequests[requestId].userId !== req.user.userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  const request = aiRequests[requestId];
  
  // Return status and suggestions if ready
  // If we are in parsing_response but have no parsed suggestions yet, present as waiting_for_response
  const normalizedStatus = (request.status === 'parsing_response' && (!request.suggestions || !request.suggestions.suggestions || request.suggestions.suggestions.length === 0))
    ? 'waiting_for_response'
    : request.status;

  // Extract the nested suggestions array and totals from the stored structure
  const response = {
    requestId,
    status: normalizedStatus,
    error: request.error,
    createdAt: request.createdAt,
    debugPrompt: request.debugPrompt,
    rawResponse: request.rawResponse
  };
  
  if (request.suggestions) {
    // Handle the nested structure: suggestions contains {suggestions: [], totals: {}}
    if (request.suggestions.suggestions) {
      response.suggestions = request.suggestions.suggestions;
      response.totals = request.suggestions.totals;
    } else {
      // Fallback if structure is different
      response.suggestions = request.suggestions;
    }
  }
  
  res.json(response);
});
 
// Serve frontend build (after API routes)
const frontendDir = path.join(__dirname, '..', 'public');
app.use(express.static(frontendDir));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexFile = path.join(frontendDir, 'index.html');
  return res.sendFile(indexFile, (err) => {
    if (err) next();
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
