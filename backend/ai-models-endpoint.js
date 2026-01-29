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