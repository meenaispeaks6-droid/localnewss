DELETE FROM public.news_articles
WHERE city = 'AI & Tools'
  AND (
    title_en ~ '[\u0900-\u097F]'
    OR title_en !~* '(\mai\M|artificial intelligence|machine learning|llm|chatbot|openai|anthropic|deepmind|gemini|claude|chatgpt|copilot|nvidia|neural|generative)'
  );