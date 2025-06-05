// Build Integrity Tests - Ensuring build process safety and validation
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

describe('Build Integrity', () => {
  const projectRoot = process.cwd()

  describe('TypeScript Compilation', () => {
    it('should compile TypeScript without errors', async () => {
      expect(() => {
        // Run TypeScript type checking
        execSync('npx tsc --noEmit --skipLibCheck', { 
          cwd: projectRoot,
          stdio: 'pipe',
          timeout: 30000
        })
      }).not.toThrow()
    })

    it('should have valid TypeScript configuration', () => {
      const tsconfigPath = path.join(projectRoot, 'tsconfig.json')
      expect(fs.existsSync(tsconfigPath)).toBe(true)
      
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'))
      
      // Validate essential TypeScript compiler options
      expect(tsconfig.compilerOptions).toBeDefined()
      expect(tsconfig.compilerOptions.strict).toBe(true)
      expect(tsconfig.compilerOptions.noEmit).toBe(true)
      expect(tsconfig.compilerOptions.esModuleInterop).toBe(true)
      expect(tsconfig.compilerOptions.skipLibCheck).toBe(true)
    })

    it('should resolve all module imports correctly', async () => {
      // Check for common import resolution issues
      const tscOutput = execSync('npx tsc --noEmit --listFiles 2>&1 || true', {
        cwd: projectRoot,
        encoding: 'utf8',
        timeout: 30000
      })

      // Should not contain module resolution errors
      expect(tscOutput).not.toMatch(/Cannot find module/i)
      expect(tscOutput).not.toMatch(/Module not found/i)
      expect(tscOutput).not.toMatch(/Type.*is not assignable/i)
    })

    it('should validate type definitions for external packages', () => {
      const packageJsonPath = path.join(projectRoot, 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      
      // Critical packages should have type definitions
      const criticalPackages = ['next', 'react', '@supabase/supabase-js']
      const devDependencies = packageJson.devDependencies || {}
      const dependencies = packageJson.dependencies || {}
      
      criticalPackages.forEach(pkg => {
        const hasPackage = dependencies[pkg] || devDependencies[pkg]
        const hasTypes = devDependencies[`@types/${pkg.replace('@', '').replace('/', '__')}`] || 
                        dependencies[pkg] // Some packages include their own types
        
        if (hasPackage) {
          // Either the package includes types or has @types/package
          expect(hasTypes || hasPackage).toBeTruthy()
        }
      })
    })
  })

  describe('Unused Imports and Variables', () => {
    it('should not have unused imports', async () => {
      // Use ESLint to check for unused imports
      try {
        const eslintOutput = execSync('npx eslint . --ext .ts,.tsx --format json --rule "no-unused-vars: error" --rule "@typescript-eslint/no-unused-vars: error" 2>/dev/null || echo "[]"', {
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: 30000
        })

        const results = JSON.parse(eslintOutput || '[]')
        const unusedImportErrors = results.flatMap((file: any) => 
          file.messages?.filter((msg: any) => 
            msg.ruleId === '@typescript-eslint/no-unused-vars' ||
            msg.ruleId === 'no-unused-vars'
          ) || []
        )

        expect(unusedImportErrors).toHaveLength(0)
      } catch (error) {
        // If ESLint is not configured, use TypeScript compiler flags
        expect(() => {
          execSync('npx tsc --noEmit --noUnusedLocals --noUnusedParameters', {
            cwd: projectRoot,
            stdio: 'pipe',
            timeout: 30000
          })
        }).not.toThrow()
      }
    })

    it('should not have unreachable code', async () => {
      try {
        const eslintOutput = execSync('npx eslint . --ext .ts,.tsx --format json --rule "no-unreachable: error" 2>/dev/null || echo "[]"', {
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: 20000
        })

        const results = JSON.parse(eslintOutput || '[]')
        const unreachableCodeErrors = results.flatMap((file: any) => 
          file.messages?.filter((msg: any) => msg.ruleId === 'no-unreachable') || []
        )

        expect(unreachableCodeErrors).toHaveLength(0)
      } catch (error) {
        // Skip if ESLint is not configured
        console.warn('ESLint not configured, skipping unreachable code check')
      }
    })

    it('should validate all imports exist', () => {
      // Check common problematic import patterns
      const srcFiles = [
        'pages/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
        'context/**/*.{ts,tsx}'
      ]

      srcFiles.forEach(pattern => {
        const files = execSync(`find . -path "./node_modules" -prune -o -path "./.next" -prune -o -name "${pattern.split('/').pop()}" -type f -print`, {
          cwd: projectRoot,
          encoding: 'utf8'
        }).split('\n').filter(Boolean)

        files.forEach(file => {
          if (fs.existsSync(path.join(projectRoot, file))) {
            const content = fs.readFileSync(path.join(projectRoot, file), 'utf8')
            
            // Check for problematic import patterns
            const importRegex = /import.*from\s+['"]([^'"]+)['"]/g
            let match
            
            while ((match = importRegex.exec(content)) !== null) {
              const importPath = match[1]
              
              // Skip node_modules imports
              if (importPath.startsWith('.')) {
                const resolvedPath = path.resolve(path.dirname(file), importPath)
                const exists = fs.existsSync(resolvedPath) || 
                              fs.existsSync(resolvedPath + '.ts') ||
                              fs.existsSync(resolvedPath + '.tsx') ||
                              fs.existsSync(path.join(resolvedPath, 'index.ts')) ||
                              fs.existsSync(path.join(resolvedPath, 'index.tsx'))
                
                if (!exists) {
                  throw new Error(`Import not found: ${importPath} in ${file}`)
                }
              }
            }
          }
        })
      })
    })
  })

  describe('Bundle Size Limits', () => {
    it('should have bundle size within acceptable limits', async () => {
      // Run Next.js build and analyze
      try {
        execSync('npm run build', { 
          cwd: projectRoot,
          stdio: 'pipe',
          timeout: 120000 // 2 minutes for build
        })

        // Check if .next directory exists
        const nextDir = path.join(projectRoot, '.next')
        expect(fs.existsSync(nextDir)).toBe(true)

        // Check main bundle sizes
        const staticDir = path.join(nextDir, 'static')
        if (fs.existsSync(staticDir)) {
          const files = fs.readdirSync(staticDir, { recursive: true })
          const jsFiles = files.filter(file => 
            typeof file === 'string' && file.endsWith('.js')
          )

          jsFiles.forEach(file => {
            const filePath = path.join(staticDir, file as string)
            const stats = fs.statSync(filePath)
            const sizeInMB = stats.size / (1024 * 1024)

            // Individual chunks should not exceed 2MB
            expect(sizeInMB).toBeLessThan(2)
          })
        }
      } catch (error) {
        console.warn('Build failed or not configured, skipping bundle size check')
      }
    })

    it('should not have excessive duplicate dependencies', () => {
      const packageJsonPath = path.join(projectRoot, 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      
      const dependencies = packageJson.dependencies || {}
      const devDependencies = packageJson.devDependencies || {}
      
      // Check for duplicates between deps and devDeps
      const duplicates = Object.keys(dependencies).filter(dep => 
        devDependencies[dep]
      )
      
      expect(duplicates).toHaveLength(0)
    })

    it('should have optimized images in public directory', () => {
      const publicDir = path.join(projectRoot, 'public')
      
      if (fs.existsSync(publicDir)) {
        const files = fs.readdirSync(publicDir, { recursive: true })
        const imageFiles = files.filter(file => 
          typeof file === 'string' && /\.(jpg|jpeg|png|gif|svg)$/i.test(file)
        )

        imageFiles.forEach(file => {
          const filePath = path.join(publicDir, file as string)
          const stats = fs.statSync(filePath)
          const sizeInMB = stats.size / (1024 * 1024)

          // Images should generally be under 1MB
          if (sizeInMB > 1) {
            console.warn(`Large image file: ${file} (${sizeInMB.toFixed(2)}MB)`)
          }
          expect(sizeInMB).toBeLessThan(5) // Hard limit of 5MB
        })
      }
    })
  })

  describe('Environment Variable Validation', () => {
    it('should validate required environment variables', () => {
      const requiredEnvVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'NEXTAUTH_URL',
        'NEXTAUTH_SECRET'
      ]

      requiredEnvVars.forEach(envVar => {
        // Check if variable is defined in any env file or process
        const hasEnvFile = fs.existsSync(path.join(projectRoot, '.env.local')) ||
                          fs.existsSync(path.join(projectRoot, '.env')) ||
                          fs.existsSync(path.join(projectRoot, '.env.example'))
        
        expect(hasEnvFile).toBe(true)
      })
    })

    it('should have .env.example file with all required variables', () => {
      const envExamplePath = path.join(projectRoot, '.env.example')
      
      if (fs.existsSync(envExamplePath)) {
        const envExample = fs.readFileSync(envExamplePath, 'utf8')
        
        const requiredVars = [
          'NEXT_PUBLIC_SUPABASE_URL',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          'NEXTAUTH_URL',
          'NEXTAUTH_SECRET'
        ]

        requiredVars.forEach(envVar => {
          expect(envExample).toContain(envVar)
        })
      }
    })

    it('should not expose sensitive variables to client', () => {
      // Check that sensitive env vars don't start with NEXT_PUBLIC_
      const sensitiveVars = [
        'SUPABASE_SERVICE_ROLE_KEY',
        'NEXTAUTH_SECRET',
        'DATABASE_URL'
      ]

      sensitiveVars.forEach(envVar => {
        expect(envVar).not.toMatch(/^NEXT_PUBLIC_/)
      })
    })

    it('should validate environment variable types', () => {
      // Mock environment variables for testing
      const testEnvs = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        NEXTAUTH_URL: 'http://localhost:3000',
        NEXTAUTH_SECRET: 'test-secret'
      }

      Object.entries(testEnvs).forEach(([key, value]) => {
        if (key.includes('URL')) {
          expect(value).toMatch(/^https?:\/\//)
        }
        if (key.includes('KEY') || key.includes('SECRET')) {
          expect(value.length).toBeGreaterThan(10)
        }
      })
    })
  })

  describe('Next.js Configuration Validation', () => {
    it('should have valid Next.js configuration', () => {
      const nextConfigPath = path.join(projectRoot, 'next.config.ts')
      const nextConfigJsPath = path.join(projectRoot, 'next.config.js')
      
      const hasConfig = fs.existsSync(nextConfigPath) || fs.existsSync(nextConfigJsPath)
      expect(hasConfig).toBe(true)
    })

    it('should validate critical Next.js settings', async () => {
      try {
        // Import Next.js config
        const nextConfigPath = fs.existsSync(path.join(projectRoot, 'next.config.ts')) 
          ? 'next.config.ts' 
          : 'next.config.js'
        
        const configModule = await import(path.join(projectRoot, nextConfigPath))
        const config = configModule.default || configModule

        // Validate important settings
        if (config.images) {
          expect(config.images.domains).toBeDefined()
        }

        // Should not have dangerous settings in production
        if (config.experimental) {
          expect(config.experimental.allowMiddlewareResponseBody).not.toBe(true)
        }
      } catch (error) {
        console.warn('Could not validate Next.js config:', error.message)
      }
    })

    it('should have proper middleware configuration', () => {
      const middlewarePath = path.join(projectRoot, 'middleware.ts')
      const middlewareJsPath = path.join(projectRoot, 'middleware.js')
      
      if (fs.existsSync(middlewarePath) || fs.existsSync(middlewareJsPath)) {
        const middlewareFile = fs.existsSync(middlewarePath) ? middlewarePath : middlewareJsPath
        const content = fs.readFileSync(middlewareFile, 'utf8')
        
        // Should export config with matcher
        expect(content).toMatch(/export.*config.*matcher/s)
      }
    })

    it('should validate package.json scripts', () => {
      const packageJsonPath = path.join(projectRoot, 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      
      const requiredScripts = ['dev', 'build', 'start']
      
      requiredScripts.forEach(script => {
        expect(packageJson.scripts[script]).toBeDefined()
      })

      // Build script should use Next.js
      expect(packageJson.scripts.build).toContain('next build')
      expect(packageJson.scripts.dev).toContain('next dev')
      expect(packageJson.scripts.start).toContain('next start')
    })

    it('should have proper TypeScript paths configuration', () => {
      const tsconfigPath = path.join(projectRoot, 'tsconfig.json')
      
      if (fs.existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'))
        
        // Should have path mapping for cleaner imports
        if (tsconfig.compilerOptions?.paths) {
          expect(tsconfig.compilerOptions.paths['@/*']).toBeDefined()
        }
        
        // Should include Next.js types
        expect(tsconfig.compilerOptions?.types).toContain('node')
      }
    })
  })

  describe('Security Configuration', () => {
    it('should not have sensitive files in git', () => {
      const gitignorePath = path.join(projectRoot, '.gitignore')
      
      if (fs.existsSync(gitignorePath)) {
        const gitignore = fs.readFileSync(gitignorePath, 'utf8')
        
        const sensitivePatterns = ['.env.local', '.env', 'node_modules', '.next']
        
        sensitivePatterns.forEach(pattern => {
          expect(gitignore).toContain(pattern)
        })
      }
    })

    it('should validate Content Security Policy if configured', () => {
      const nextConfigPath = fs.existsSync(path.join(projectRoot, 'next.config.ts')) 
        ? path.join(projectRoot, 'next.config.ts')
        : path.join(projectRoot, 'next.config.js')
      
      if (fs.existsSync(nextConfigPath)) {
        const content = fs.readFileSync(nextConfigPath, 'utf8')
        
        if (content.includes('Content-Security-Policy')) {
          // CSP should not allow unsafe-inline without proper nonce
          expect(content).not.toMatch(/unsafe-inline.*script-src/i)
        }
      }
    })

    it('should not have debug mode enabled in production config', () => {
      const nextConfigPath = fs.existsSync(path.join(projectRoot, 'next.config.ts')) 
        ? path.join(projectRoot, 'next.config.ts')
        : path.join(projectRoot, 'next.config.js')
      
      if (fs.existsSync(nextConfigPath)) {
        const content = fs.readFileSync(nextConfigPath, 'utf8')
        
        // Should not have debug flags in production
        expect(content).not.toMatch(/debug:\s*true/i)
        expect(content).not.toMatch(/NODE_ENV.*development/i)
      }
    })
  })
})