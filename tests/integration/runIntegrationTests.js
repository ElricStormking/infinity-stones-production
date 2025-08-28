#!/usr/bin/env node

/**
 * Integration Test Runner for Phase 5 Casino System
 * 
 * Task 8.1: End-to-end integration testing runner
 * 
 * This script runs all integration tests and generates comprehensive reports
 * validating the complete casino system functionality.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class IntegrationTestRunner {
    constructor() {
        this.testResults = {
            startTime: new Date(),
            endTime: null,
            duration: 0,
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            categories: {},
            performance: {},
            coverage: {},
            errors: []
        };

        this.testCategories = [
            {
                name: 'Client-Server Integration',
                path: './EndToEndIntegration.test.js',
                description: 'Complete user journey and client-server communication'
            },
            {
                name: 'Server-Side Integration',
                path: '../infinity-storm-server/tests/integration/ServerIntegration.test.js',
                description: 'Database, game engine, and API integration'
            },
            {
                name: 'Cascade Synchronization',
                path: '../infinity-storm-server/tests/cascade/EndToEndCascade.test.js',
                description: 'Real-time cascade synchronization system'
            },
            {
                name: 'WebSocket Integration',
                path: '../infinity-storm-server/tests/websocket/WebSocketIntegration.test.js',
                description: 'Real-time communication and event handling'
            },
            {
                name: 'Performance Integration',
                path: '../infinity-storm-server/tests/cascade/PerformanceStress.test.js',
                description: 'System performance under load'
            }
        ];
    }

    async runAllTests() {
        console.log('🚀 Starting Comprehensive Integration Testing');
        console.log('='.repeat(80));

        this.displayTestOverview();

        for (const category of this.testCategories) {
            await this.runTestCategory(category);
        }

        this.calculateFinalResults();
        this.generateReport();

        return this.testResults;
    }

    displayTestOverview() {
        console.log('\n📋 Test Categories:');
        this.testCategories.forEach((category, index) => {
            console.log(`${index + 1}. ${category.name}`);
            console.log(`   ${category.description}`);
            console.log(`   Path: ${category.path}`);
        });
        console.log();
    }

    async runTestCategory(category) {
        console.log(`\n🧪 Running ${category.name}...`);
        console.log('-'.repeat(60));

        const categoryResults = {
            name: category.name,
            startTime: new Date(),
            endTime: null,
            duration: 0,
            passed: 0,
            failed: 0,
            total: 0,
            output: '',
            errors: []
        };

        try {
            const testPath = path.resolve(__dirname, category.path);
            
            if (!fs.existsSync(testPath)) {
                console.log(`⚠️  Test file not found: ${testPath}`);
                categoryResults.errors.push(`Test file not found: ${testPath}`);
                this.testResults.categories[category.name] = categoryResults;
                return;
            }

            const result = await this.executeJestTest(testPath);
            
            categoryResults.endTime = new Date();
            categoryResults.duration = categoryResults.endTime - categoryResults.startTime;
            categoryResults.passed = result.passed;
            categoryResults.failed = result.failed;
            categoryResults.total = result.total;
            categoryResults.output = result.output;

            if (result.errors.length > 0) {
                categoryResults.errors = result.errors;
            }

            // Update overall results
            this.testResults.totalTests += categoryResults.total;
            this.testResults.passedTests += categoryResults.passed;
            this.testResults.failedTests += categoryResults.failed;

            this.displayCategoryResults(categoryResults);

        } catch (error) {
            categoryResults.errors.push(error.message);
            console.log(`❌ Error running ${category.name}: ${error.message}`);
        }

        this.testResults.categories[category.name] = categoryResults;
    }

    async executeJestTest(testPath) {
        return new Promise((resolve, reject) => {
            const jestArgs = [
                testPath,
                '--verbose',
                '--colors',
                '--detectOpenHandles',
                '--forceExit',
                '--maxWorkers=1'
            ];

            const jest = spawn('npx', ['jest', ...jestArgs], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd()
            });

            let output = '';
            let errorOutput = '';

            jest.stdout.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                process.stdout.write(chunk);
            });

            jest.stderr.on('data', (data) => {
                const chunk = data.toString();
                errorOutput += chunk;
                process.stderr.write(chunk);
            });

            jest.on('close', (code) => {
                const result = this.parseJestOutput(output, errorOutput);
                result.exitCode = code;

                if (code === 0) {
                    resolve(result);
                } else {
                    result.errors.push(`Jest exited with code ${code}`);
                    resolve(result); // Don't reject, continue with other tests
                }
            });

            jest.on('error', (error) => {
                reject(new Error(`Failed to start Jest: ${error.message}`));
            });
        });
    }

    parseJestOutput(output, errorOutput) {
        const result = {
            passed: 0,
            failed: 0,
            total: 0,
            output: output,
            errors: []
        };

        // Parse Jest output for test results
        const testResultPattern = /Tests:\s+(\d+)\s+failed.*?(\d+)\s+passed.*?(\d+)\s+total/;
        const passOnlyPattern = /Tests:\s+(\d+)\s+passed.*?(\d+)\s+total/;
        
        let match = output.match(testResultPattern);
        if (match) {
            result.failed = parseInt(match[1]);
            result.passed = parseInt(match[2]);
            result.total = parseInt(match[3]);
        } else {
            match = output.match(passOnlyPattern);
            if (match) {
                result.passed = parseInt(match[1]);
                result.total = parseInt(match[2]);
                result.failed = 0;
            }
        }

        // Extract error information
        if (errorOutput) {
            result.errors.push(errorOutput);
        }

        // Look for specific error patterns in output
        const errorPatterns = [
            /Error: (.+)/g,
            /FAIL (.+)/g,
            /● (.+)/g
        ];

        errorPatterns.forEach(pattern => {
            let errorMatch;
            while ((errorMatch = pattern.exec(output)) !== null) {
                result.errors.push(errorMatch[1]);
            }
        });

        return result;
    }

    displayCategoryResults(categoryResults) {
        const { name, passed, failed, total, duration } = categoryResults;
        const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;
        const status = failed === 0 ? '✅ PASSED' : '❌ FAILED';

        console.log(`\n${status} ${name}`);
        console.log(`   Tests: ${passed} passed, ${failed} failed, ${total} total`);
        console.log(`   Success Rate: ${successRate}%`);
        console.log(`   Duration: ${duration}ms`);

        if (categoryResults.errors.length > 0) {
            console.log(`   Errors: ${categoryResults.errors.length}`);
            categoryResults.errors.slice(0, 3).forEach(error => {
                console.log(`     - ${error.substring(0, 100)}...`);
            });
        }
    }

    calculateFinalResults() {
        this.testResults.endTime = new Date();
        this.testResults.duration = this.testResults.endTime - this.testResults.startTime;

        // Calculate performance metrics
        this.testResults.performance = {
            totalDuration: this.testResults.duration,
            averageTestTime: this.testResults.totalTests > 0 ? 
                this.testResults.duration / this.testResults.totalTests : 0,
            testsPerSecond: this.testResults.totalTests > 0 ? 
                (this.testResults.totalTests * 1000) / this.testResults.duration : 0
        };

        // Calculate coverage metrics
        this.testResults.coverage = {
            overallSuccessRate: this.testResults.totalTests > 0 ? 
                ((this.testResults.passedTests / this.testResults.totalTests) * 100).toFixed(2) : 0,
            categoriesPassed: Object.values(this.testResults.categories)
                .filter(cat => cat.failed === 0).length,
            totalCategories: Object.keys(this.testResults.categories).length
        };
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('🎯 INTEGRATION TESTING COMPLETE');
        console.log('='.repeat(80));

        this.displayOverallResults();
        this.displayCategoryBreakdown();
        this.displayPerformanceMetrics();
        this.displayRecommendations();

        // Save detailed report to file
        this.saveDetailedReport();
    }

    displayOverallResults() {
        const { totalTests, passedTests, failedTests, coverage } = this.testResults;
        const overallStatus = failedTests === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED';

        console.log(`\n📊 Overall Results: ${overallStatus}`);
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Passed: ${passedTests} (${coverage.overallSuccessRate}%)`);
        console.log(`   Failed: ${failedTests}`);
        console.log(`   Duration: ${(this.testResults.duration / 1000).toFixed(2)}s`);
        console.log(`   Categories: ${coverage.categoriesPassed}/${coverage.totalCategories} passed`);
    }

    displayCategoryBreakdown() {
        console.log('\n📁 Category Breakdown:');
        
        Object.values(this.testResults.categories).forEach(category => {
            const successRate = category.total > 0 ? 
                ((category.passed / category.total) * 100).toFixed(1) : 0;
            const status = category.failed === 0 ? '✅' : '❌';
            
            console.log(`   ${status} ${category.name}: ${category.passed}/${category.total} (${successRate}%)`);
            
            if (category.errors.length > 0) {
                console.log(`      └─ ${category.errors.length} error(s)`);
            }
        });
    }

    displayPerformanceMetrics() {
        const { performance } = this.testResults;
        
        console.log('\n⚡ Performance Metrics:');
        console.log(`   Total Duration: ${(performance.totalDuration / 1000).toFixed(2)}s`);
        console.log(`   Average Test Time: ${performance.averageTestTime.toFixed(2)}ms`);
        console.log(`   Tests per Second: ${performance.testsPerSecond.toFixed(2)}`);
    }

    displayRecommendations() {
        const recommendations = [];

        if (this.testResults.failedTests > 0) {
            recommendations.push('🔧 Fix failing tests before deployment');
        }

        if (this.testResults.performance.averageTestTime > 5000) {
            recommendations.push('⚡ Consider optimizing slow tests');
        }

        if (this.testResults.coverage.overallSuccessRate < 95) {
            recommendations.push('📈 Improve test reliability and coverage');
        }

        Object.values(this.testResults.categories).forEach(category => {
            if (category.errors.length > 0) {
                recommendations.push(`🐛 Review errors in ${category.name} category`);
            }
        });

        if (recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            recommendations.forEach(rec => console.log(`   ${rec}`));
        } else {
            console.log('\n🎉 All integration tests are performing excellently!');
        }
    }

    saveDetailedReport() {
        const reportPath = path.join(__dirname, 'integration-test-report.json');
        
        try {
            fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
            console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        } catch (error) {
            console.log(`⚠️  Could not save report: ${error.message}`);
        }
    }
}

// Main execution
async function main() {
    const runner = new IntegrationTestRunner();
    
    try {
        const results = await runner.runAllTests();
        
        // Exit with appropriate code
        const exitCode = results.failedTests > 0 ? 1 : 0;
        process.exit(exitCode);
        
    } catch (error) {
        console.error('❌ Integration test runner failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = IntegrationTestRunner;