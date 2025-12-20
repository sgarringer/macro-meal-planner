require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Database setup
const db = new sqlite3.Database('./macro_meal_planner.db');

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

    // Add active column to existing foods table if it doesn't exist
    db.run(`ALTER TABLE foods ADD COLUMN active BOOLEAN DEFAULT 1`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding active column to foods:', err);
      }
    });

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
});

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if the origin is allowed
    const allowedOrigins = ['https://5173-5f449670-b992-4b6b-92c2-a0cb7f1ade5f.proxy.daytona.works'];
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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
  const { calories, protein, carbs, fat } = req.body;
  
  if (!calories || !protein || !carbs || !fat) {
    return res.status(400).json({ error: 'All macro values are required' });
  }

  // Deactivate existing goals
  db.run('UPDATE user_macro_goals SET is_active = 0 WHERE user_id = ?', [req.user.userId], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Insert new goals
    db.run('INSERT INTO user_macro_goals (user_id, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?)',
      [req.user.userId, calories, protein, carbs, fat], function(err) {
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
          is_active: 1
          }
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
  let query = 'SELECT * FROM foods WHERE (user_id = ? OR user_id IS NULL)';
  let params = [req.user.userId];
  
  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }
  
  if (type === 'user') {
    query += ' AND user_id = ?';
    params.push(req.user.userId);
  } else if (type === 'common') {
    query += ' AND user_id IS NULL';
  }
  
  query += ' ORDER BY name';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/foods', authenticateToken, (req, res) => {
  const { name, brand, serving_size, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving } = req.body;
  
  if (!name || !serving_size || !calories_per_serving || !protein_per_serving || !carbs_per_serving || !fat_per_serving) {
    return res.status(400).json({ error: 'All nutrition fields are required' });
  }

  db.run('INSERT INTO foods (user_id, name, brand, serving_size, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.userId, name, brand, serving_size, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving], function(err) {
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
        fat_per_serving
      }
    });
  });
});

// Meal plans routes
  app.get('/api/meal-plans', authenticateToken, (req, res) => {
  const { date } = req.query;
  let query = `
    SELECT mp.*, m.name as meal_name, m.type as meal_type, f.name as food_name, f.serving_size, 
           f.calories_per_serving, f.protein_per_serving, f.carbs_per_serving, f.fat_per_serving
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
          ollama_enabled: false,
          ollama_endpoint: 'http://localhost:11434',
          ollama_model: '',
          preferred_service: null
        });
      }
      
      res.json({
        openai_enabled: !!row.openai_enabled,
        openai_api_key: row.openai_api_key || '',
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
  

//   app.post('/api/ai-suggest', authenticateToken, async (req, res) => {
//     try {
//       const { scope, preferences } = req.body;
//       
//       // Get user's AI config
//       db.get('SELECT * FROM ai_config WHERE user_id = ?', [req.user.userId], async (err, config) => {
//         if (err) {
//           return res.status(500).json({ error: 'Database error' });
// 
//         if (!config || (!config.openai_enabled && !config.ollama_enabled)) {
//           return res.status(400).json({ error: 'No AI service configured' });
// 
//         // Get user's data
//         const [macroGoalsRes, mealsRes, foodsRes] = await Promise.all([
//           new Promise(resolve => {
//             db.get('SELECT * FROM user_macro_goals WHERE user_id = ? AND is_active = 1', 
//               [req.user.userId], (err, row) => resolve(row));
//           }),
//           new Promise(resolve => {
//             db.all('SELECT * FROM meals WHERE user_id = ?', [req.user.userId], (err, rows) => resolve(rows));
//           }),
//           new Promise(resolve => {
//             db.all('SELECT * FROM foods WHERE user_id = ? OR user_id IS NULL LIMIT 50', 
//               [req.user.userId], (err, rows) => resolve(rows));
//           })
//         ]);
// 
//         // Build AI prompt
//         let prompt = `You are a professional nutritionist and meal planning expert. `;
//         
//         if (scope === 'daily') {
//           prompt += `Create a daily meal plan for someone with these macro goals: `;
//           if (macroGoalsRes) {
//             prompt += `${macroGoalsRes.calories} calories, ${macroGoalsRes.protein}g protein, ${macroGoalsRes.carbs}g carbs, ${macroGoalsRes.fat}g fat. `;
//           }
//         } else if (scope === 'weekly') {
//           prompt += `Create a weekly meal plan with variety for someone with these macro goals: `;
//           if (macroGoalsRes) {
//             prompt += `Daily targets: ${macroGoalsRes.calories} calories, ${macroGoalsRes.protein}g protein, ${macroGoalsRes.carbs}g carbs, ${macroGoalsRes.fat}g fat. `;
//           }
//         } else if (scope === 'meal') {
//           prompt += `Suggest meal ideas for someone with these macro goals: `;
//           if (macroGoalsRes) {
//             prompt += `${macroGoalsRes.calories} calories, ${macroGoalsRes.protein}g protein, ${macroGoalsRes.carbs}g carbs, ${macroGoalsRes.fat}g fat. `;
//           }
// 
//         if (mealsRes && mealsRes.length > 0) {
//           prompt += `Their meal schedule is: ${mealsRes.map(m => `${m.name} (${m.time_start}-${m.time_end})`).join(', ')}. `;
// 
//         if (foodsRes && foodsRes.length > 0) {
//           prompt += `Available foods include: ${foodsRes.slice(0, 20).map(f => f.name).join(', ')}. `;
// 
//         if (preferences) {
//           prompt += `Additional preferences: ${preferences}. `;
// 
//         prompt += `Provide specific, actionable suggestions with food names and approximate quantities. Focus on whole foods and balanced nutrition. Format your response as a JSON object with suggestions array containing objects with name, description, and approximate macros.`;
// 
//         let aiResponse;
//         
//         // Try preferred service first
//         const service = config.preferred_service || (config.openai_enabled ? 'openai' : 'ollama');
//         
//         if (service === 'openai' && config.openai_enabled && config.openai_api_key) {
//           try {
//             const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
//               method: 'POST',
//               headers: {
//                 'Authorization': `Bearer ${config.openai_api_key}`,
//                 'Content-Type': 'application/json'
//               },
//               body: JSON.stringify({
//                 model: config.ollama_model || 'gpt-3.5-turbo',
//                 messages: [{ role: 'user', content: prompt }],
//                 max_tokens: 1000,
//                 temperature: 0.7
//               })
//             });
// 
//             if (openaiResponse.ok) {
//               const openaiData = await openaiResponse.json();
//               aiResponse = openaiData.choices[0].message.content;
//             }
//           } catch (error) {
//             console.error('OpenAI API error:', error);
//           }
// 
//         // Fallback to Ollama if OpenAI failed or not preferred
//         if (!aiResponse && config.ollama_enabled && config.ollama_endpoint && config.ollama_model) {
//           try {
//             const ollamaResponse = await fetch(`${config.ollama_endpoint}/api/generate`, {
//               method: 'POST',
//               headers: { 'Content-Type': 'application/json' },
//               body: JSON.stringify({
//                 model: config.ollama_model,
//                 prompt: prompt,
//                 stream: false
//               })
//             });
// 
//             if (ollamaResponse.ok) {
//               const ollamaData = await ollamaResponse.json();
//               aiResponse = ollamaData.response;
//             }
//           } catch (error) {
//             console.error('Ollama API error:', error);
//           }
// 
//         if (!aiResponse) {
//           return res.status(500).json({ error: 'Failed to get AI suggestion' });
// 
//         try {
//           // Try to parse as JSON, otherwise return as plain text
//           const suggestions = JSON.parse(aiResponse);
//           res.json({
//             suggestions: suggestions.suggestions || suggestions,
//             raw_response: aiResponse,
//             provider: service
//           });
//         } catch (parseError) {
//           res.json({
//             suggestions: [{ 
//               name: 'AI Suggestion', 
//               description: aiResponse,
//               provider: service
//             }],
//             raw_response: aiResponse,
//             provider: service
//           });
//     } catch (error) {
//       res.status(500).json({ error: 'Failed to generate AI suggestion' });
//     }
//   });
// 
  // 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
