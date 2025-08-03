const aws = require('aws-sdk');

// Mock AWS SDK
jest.mock('aws-sdk');

// Import the Lambda functions (we'll test the logic directly)
const { handler: configRulesHandler } = require('../src/lambda/configRulesWidget');
const { handler: configComplianceHandler } = require('../src/lambda/configComplianceWidget');
const { handler: configRemediationHandler } = require('../src/lambda/configRemediationWidget');

describe('AWS Config Custom Widgets', () => {
  let mockConfigService;
  let mockPromise;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock promise
    mockPromise = jest.fn();
    
    // Setup mock Config service
    mockConfigService = {
      describeConfigRules: jest.fn().mockReturnValue({ promise: mockPromise }),
      getComplianceSummaryByConfigRule: jest.fn().mockReturnValue({ promise: mockPromise }),
      getComplianceDetailsByConfigRule: jest.fn().mockReturnValue({ promise: mockPromise })
    };
    
    // Mock AWS.ConfigService constructor
    aws.ConfigService.mockImplementation(() => mockConfigService);
  });

  describe('Config Rules Widget', () => {
    it('should return HTML for config rules widget', async () => {
      // Mock successful API responses
      mockPromise
        .mockResolvedValueOnce({
          ConfigRules: [
            {
              ConfigRuleName: 'test-rule-1',
              Description: 'Test rule 1',
              Scope: {
                ComplianceResourceTypes: ['AWS::S3::Bucket']
              }
            },
            {
              ConfigRuleName: 'test-rule-2',
              Description: 'Test rule 2',
              Scope: {
                ComplianceResourceTypes: ['AWS::EC2::Instance']
              }
            }
          ]
        })
        .mockResolvedValueOnce({
          ComplianceSummaryByConfigRule: [
            {
              ConfigRuleName: 'test-rule-1',
              ComplianceSummary: {
                CompliantResourceCount: 5,
                NonCompliantResourceCount: 2,
                TotalResourceCount: 7
              }
            },
            {
              ConfigRuleName: 'test-rule-2',
              ComplianceSummary: {
                CompliantResourceCount: 3,
                NonCompliantResourceCount: 0,
                TotalResourceCount: 3
              }
            }
          ]
        });

      const event = {
        widgetContext: {
          width: 400,
          height: 300,
          theme: 'light',
          region: 'us-east-1'
        },
        params: {}
      };

      const result = await configRulesHandler(event);

      // Verify the result contains expected HTML
      expect(result).toContain('AWS Config Rules Status');
      expect(result).toContain('test-rule-1');
      expect(result).toContain('test-rule-2');
      expect(result).toContain('Compliant');
      expect(result).toContain('Non-Compliant');
      expect(result).toContain('Insufficient Data');
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error
      mockPromise.mockRejectedValue(new Error('API Error'));

      const event = {
        widgetContext: {
          theme: 'light'
        },
        params: {}
      };

      const result = await configRulesHandler(event);

      // Verify error HTML is returned
      expect(result).toContain('AWS Config Widget Error');
      expect(result).toContain('API Error');
    });

    it('should filter rules by compliance status', async () => {
      // Mock API responses
      mockPromise
        .mockResolvedValueOnce({
          ConfigRules: [
            {
              ConfigRuleName: 'compliant-rule',
              Description: 'Compliant rule'
            },
            {
              ConfigRuleName: 'non-compliant-rule',
              Description: 'Non-compliant rule'
            }
          ]
        })
        .mockResolvedValueOnce({
          ComplianceSummaryByConfigRule: [
            {
              ConfigRuleName: 'compliant-rule',
              ComplianceSummary: {
                CompliantResourceCount: 5,
                NonCompliantResourceCount: 0,
                TotalResourceCount: 5
              }
            },
            {
              ConfigRuleName: 'non-compliant-rule',
              ComplianceSummary: {
                CompliantResourceCount: 0,
                NonCompliantResourceCount: 3,
                TotalResourceCount: 3
              }
            }
          ]
        });

      const event = {
        widgetContext: {
          theme: 'light'
        },
        params: {
          complianceStatus: 'COMPLIANT'
        }
      };

      const result = await configRulesHandler(event);

      // Should only show compliant rules
      expect(result).toContain('compliant-rule');
      expect(result).not.toContain('non-compliant-rule');
    });
  });

  describe('Config Compliance Widget', () => {
    it('should return HTML for compliance summary', async () => {
      // Mock successful API responses
      mockPromise
        .mockResolvedValueOnce({
          ConfigRules: [
            {
              ConfigRuleName: 'test-rule-1',
              Description: 'Test rule 1'
            }
          ]
        })
        .mockResolvedValueOnce({
          ComplianceSummaryByConfigRule: [
            {
              ConfigRuleName: 'test-rule-1',
              ComplianceSummary: {
                CompliantResourceCount: 5,
                NonCompliantResourceCount: 2,
                TotalResourceCount: 7
              }
            }
          ]
        });

      const event = {
        widgetContext: {
          width: 400,
          height: 300,
          theme: 'light'
        },
        params: {}
      };

      const result = await configComplianceHandler(event);

      // Verify the result contains expected HTML
      expect(result).toContain('Compliance Summary');
      expect(result).toContain('test-rule-1');
      expect(result).toContain('Compliant Rules:');
      expect(result).toContain('Non-Compliant Rules:');
    });

    it('should return HTML for rule details when ruleName is provided', async () => {
      // Mock API response for specific rule
      mockPromise.mockResolvedValueOnce({
        EvaluationResults: [
          {
            ComplianceType: 'COMPLIANT',
            EvaluationResultIdentifier: {
              EvaluationResultQualifier: {
                ResourceId: 'test-resource-1',
                ResourceType: 'AWS::S3::Bucket'
              }
            }
          },
          {
            ComplianceType: 'NON_COMPLIANT',
            EvaluationResultIdentifier: {
              EvaluationResultQualifier: {
                ResourceId: 'test-resource-2',
                ResourceType: 'AWS::EC2::Instance'
              }
            }
          }
        ]
      });

      const event = {
        widgetContext: {
          width: 400,
          height: 300,
          theme: 'light'
        },
        params: {
          ruleName: 'test-rule'
        }
      };

      const result = await configComplianceHandler(event);

      // Verify the result contains expected HTML
      expect(result).toContain('Rule: test-rule');
      expect(result).toContain('test-resource-1');
      expect(result).toContain('test-resource-2');
      expect(result).toContain('Compliant Resources:');
      expect(result).toContain('Non-Compliant Resources:');
    });
  });

  describe('Config Remediation Widget', () => {
    it('should return HTML for remediation dashboard', async () => {
      // Mock successful API responses
      mockPromise
        .mockResolvedValueOnce({
          ConfigRules: [
            {
              ConfigRuleName: 'non-compliant-rule',
              Description: 'Non-compliant rule that needs remediation'
            }
          ]
        })
        .mockResolvedValueOnce({
          ComplianceSummaryByConfigRule: [
            {
              ConfigRuleName: 'non-compliant-rule',
              ComplianceSummary: {
                CompliantResourceCount: 0,
                NonCompliantResourceCount: 3,
                TotalResourceCount: 3
              }
            }
          ]
        });

      const event = {
        widgetContext: {
          width: 400,
          height: 300,
          theme: 'light'
        },
        params: {}
      };

      const result = await configRemediationHandler(event);

      // Verify the result contains expected HTML
      expect(result).toContain('Remediation Dashboard');
      expect(result).toContain('non-compliant-rule');
      expect(result).toContain('Remediate');
      expect(result).toContain('Check Status');
    });

    it('should handle remediation action for specific rule', async () => {
      // Mock API response for rule details
      mockPromise.mockResolvedValueOnce({
        ConfigRules: [
          {
            ConfigRuleName: 'test-rule',
            Source: {
              Owner: 'AWS'
            }
          }
        ]
      });

      const event = {
        widgetContext: {
          theme: 'light'
        },
        params: {
          action: 'remediateRule',
          ruleName: 'test-rule'
        }
      };

      const result = await configRemediationHandler(event);

      // Verify the result contains remediation guidance
      expect(result).toContain('Remediation: test-rule');
      expect(result).toContain('Step 1');
      expect(result).toContain('Check Status');
    });

    it('should handle remediation status check', async () => {
      // Mock API response for compliance details
      mockPromise.mockResolvedValueOnce({
        EvaluationResults: [
          {
            ComplianceType: 'NON_COMPLIANT',
            EvaluationResultIdentifier: {
              EvaluationResultQualifier: {
                ResourceId: 'test-resource',
                ResourceType: 'AWS::S3::Bucket'
              }
            }
          }
        ]
      });

      const event = {
        widgetContext: {
          theme: 'light'
        },
        params: {
          action: 'getRemediationStatus',
          ruleName: 'test-rule'
        }
      };

      const result = await configRemediationHandler(event);

      // Verify the result contains status information
      expect(result).toContain('Status: test-rule');
      expect(result).toContain('test-resource');
      expect(result).toContain('resources still need remediation');
    });
  });

  describe('Widget Context Integration', () => {
    it('should use widget context for responsive design', async () => {
      // Mock API responses
      mockPromise
        .mockResolvedValueOnce({
          ConfigRules: []
        })
        .mockResolvedValueOnce({
          ComplianceSummaryByConfigRule: []
        });

      const event = {
        widgetContext: {
          width: 800,
          height: 600,
          theme: 'dark',
          region: 'us-west-2'
        },
        params: {}
      };

      const result = await configRulesHandler(event);

      // Verify widget dimensions are used
      expect(result).toContain('width: 800px');
      expect(result).toContain('height: 600px');
      
      // Verify dark theme is applied
      expect(result).toContain('#0d1117'); // Dark background
      expect(result).toContain('#e1e4e8'); // Dark text
    });

    it('should handle missing widget context gracefully', async () => {
      // Mock API responses
      mockPromise
        .mockResolvedValueOnce({
          ConfigRules: []
        })
        .mockResolvedValueOnce({
          ComplianceSummaryByConfigRule: []
        });

      const event = {
        params: {}
      };

      const result = await configRulesHandler(event);

      // Should use default values
      expect(result).toContain('width: 400px');
      expect(result).toContain('height: 300px');
      expect(result).toContain('theme: light');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      // Mock network error
      mockPromise.mockRejectedValue(new Error('Network timeout'));

      const event = {
        widgetContext: {
          theme: 'light'
        },
        params: {}
      };

      const result = await configRulesHandler(event);

      expect(result).toContain('Network timeout');
      expect(result).toContain('Check CloudWatch logs for more details');
    });

    it('should handle missing rule name for remediation', async () => {
      const event = {
        widgetContext: {
          theme: 'light'
        },
        params: {
          action: 'remediateRule'
          // Missing ruleName
        }
      };

      const result = await configRemediationHandler(event);

      expect(result).toContain('Rule name is required for remediation');
    });

    it('should handle rule not found', async () => {
      // Mock empty response
      mockPromise.mockResolvedValueOnce({
        ConfigRules: []
      });

      const event = {
        widgetContext: {
          theme: 'light'
        },
        params: {
          action: 'remediateRule',
          ruleName: 'non-existent-rule'
        }
      };

      const result = await configRemediationHandler(event);

      expect(result).toContain('Rule non-existent-rule not found');
    });
  });

  describe('Parameter Validation', () => {
    it('should filter by rule names', async () => {
      // Mock API responses
      mockPromise
        .mockResolvedValueOnce({
          ConfigRules: [
            {
              ConfigRuleName: 'rule-1',
              Description: 'Rule 1'
            },
            {
              ConfigRuleName: 'rule-2',
              Description: 'Rule 2'
            },
            {
              ConfigRuleName: 'rule-3',
              Description: 'Rule 3'
            }
          ]
        })
        .mockResolvedValueOnce({
          ComplianceSummaryByConfigRule: [
            {
              ConfigRuleName: 'rule-1',
              ComplianceSummary: {
                CompliantResourceCount: 5,
                NonCompliantResourceCount: 0,
                TotalResourceCount: 5
              }
            },
            {
              ConfigRuleName: 'rule-2',
              ComplianceSummary: {
                CompliantResourceCount: 0,
                NonCompliantResourceCount: 3,
                TotalResourceCount: 3
              }
            },
            {
              ConfigRuleName: 'rule-3',
              ComplianceSummary: {
                CompliantResourceCount: 2,
                NonCompliantResourceCount: 1,
                TotalResourceCount: 3
              }
            }
          ]
        });

      const event = {
        widgetContext: {
          theme: 'light'
        },
        params: {
          ruleNames: ['rule-1', 'rule-3']
        }
      };

      const result = await configRulesHandler(event);

      // Should only show specified rules
      expect(result).toContain('rule-1');
      expect(result).toContain('rule-3');
      expect(result).not.toContain('rule-2');
    });

    it('should filter by resource types', async () => {
      // Mock API responses
      mockPromise
        .mockResolvedValueOnce({
          ConfigRules: [
            {
              ConfigRuleName: 's3-rule',
              Description: 'S3 rule',
              Scope: {
                ComplianceResourceTypes: ['AWS::S3::Bucket']
              }
            },
            {
              ConfigRuleName: 'ec2-rule',
              Description: 'EC2 rule',
              Scope: {
                ComplianceResourceTypes: ['AWS::EC2::Instance']
              }
            }
          ]
        })
        .mockResolvedValueOnce({
          ComplianceSummaryByConfigRule: [
            {
              ConfigRuleName: 's3-rule',
              ComplianceSummary: {
                CompliantResourceCount: 5,
                NonCompliantResourceCount: 0,
                TotalResourceCount: 5
              }
            },
            {
              ConfigRuleName: 'ec2-rule',
              ComplianceSummary: {
                CompliantResourceCount: 0,
                NonCompliantResourceCount: 3,
                TotalResourceCount: 3
              }
            }
          ]
        });

      const event = {
        widgetContext: {
          theme: 'light'
        },
        params: {
          resourceTypes: ['AWS::S3::Bucket']
        }
      };

      const result = await configRulesHandler(event);

      // Should only show S3 rules
      expect(result).toContain('s3-rule');
      expect(result).not.toContain('ec2-rule');
    });
  });
}); 