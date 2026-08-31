const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /\} else if \(isBYOK\) \{\n\s+throw new Error\(\`Your API key was rejected for model \$\{actualModelUsed\}\. Please select a different image model in Settings\. \(\$\{error\.message\}\)\`\);\n\s+\} else \{\n\s+throw error;\n\s+\}/,
  `} else if (isBYOK) {
            if (error.status === 429 || (error.message && error.message.includes('429')) || (error.message && error.message.includes('Quota'))) {
               throw new Error(\`Your API key hit a rate limit or does not have a billing account for \${actualModelUsed}. Please enable billing in Google AI Studio or select a different image model in Settings. (\${error.status})\`);
            }
            throw new Error(\`Your API key was rejected for model \${actualModelUsed}. Please select a different image model in Settings. (\${error.message})\`);
          } else {
            if (error.status === 429 || (error.message && error.message.includes('429')) || (error.message && error.message.includes('Quota'))) {
                throw new Error(\`The system free tier quota is exhausted for \${actualModelUsed}. Please enter your own API key in Settings (Requires a paid tier / billing enabled key for image generation).\`);
            }
            throw error;
          }`
);

fs.writeFileSync('server.ts', content);
