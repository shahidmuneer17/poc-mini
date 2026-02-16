{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "outDir": ".build",
    "sourceMap": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", ".serverless", ".build"]
}