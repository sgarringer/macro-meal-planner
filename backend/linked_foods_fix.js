app.post('/api/linked-foods', authenticateToken, (req, res) => {
      const { name, description, components } = req.body;
      
      if (!name || !components || components.length === 0) {
        return res.status(400).json({ error: 'Name and at least one component are required' });
      }

      db.serialize(() => {
        db.run('INSERT INTO linked_foods (user_id, name, description) VALUES (?, ?, ?)',
          [req.user.userId, name, description], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create linked food' });
          }
          
          const linkedFoodId = this.lastID;
          
          // Insert components
          const componentPromises = components.map(component => {
            return new Promise((resolve, reject) => {
              db.run('INSERT INTO linked_food_components (linked_food_id, food_id, quantity) VALUES (?, ?, ?)',
                [linkedFoodId, component.food_id, component.quantity], function(err) {
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