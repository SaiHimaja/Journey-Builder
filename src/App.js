import React, { useState, useEffect } from 'react';
import { fetchGraphData } from './services/api';  
import './App.css';

// Part 9.1: Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <h2 style={{ color: '#d62828' }}>Something went wrong</h2>
          <p style={{ color: '#6c757d' }}>{this.state.error?.message}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0077b6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedForm, setSelectedForm] = useState(null);
  const [prefillMappings, setPrefillMappings] = useState({});
  const [configuringField, setConfiguringField] = useState(null);
  const [showPrefillModal, setShowPrefillModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  
  // Part 9.4: User Feedback States
  const [notification, setNotification] = useState(null);
  const [savingMapping, setSavingMapping] = useState(false);
  const [fieldValidationWarning, setFieldValidationWarning] = useState(null);

  // Step 8.1: Data Source Interface
  const DATA_SOURCE_TYPES = {
    FORM_FIELD: 'form_field',
    GLOBAL: 'global',
    URL_PARAM: 'url_param',
    API: 'api',
    CALCULATED: 'calculated'
  };

  const createDataSource = (type, config) => ({
    type,
    ...config,
    getValue: config.getValue || (() => null),
    isAvailable: config.isAvailable || (() => true)
  });

  const dataSourceRegistry = new Map();

  // Step 8.2: Source Providers
  dataSourceRegistry.set(DATA_SOURCE_TYPES.FORM_FIELD, {
    name: 'Form Fields',
    getAvailableSources: (context) => {
      const { selectedForm, graphData, getAccessibleForms, getFormFields } = context;
      const accessible = getAccessibleForms(selectedForm.id);
      
      const sources = [];
      
      accessible.direct.forEach(form => {
        const fields = getFormFields(form, graphData);
        fields.forEach(field => {
          sources.push(createDataSource(DATA_SOURCE_TYPES.FORM_FIELD, {
            id: `${form.id}.${field.id}`,
            formId: form.id,
            fieldId: field.id,
            displayName: `${form.data?.name || form.id} → ${field.name}`,
            category: 'Direct Dependency',
            metadata: {
              formName: form.data?.name || form.id,
              fieldName: field.name,
              fieldType: field.type
            }
          }));
        });
      });
      
      accessible.transitive.forEach(form => {
        const fields = getFormFields(form, graphData);
        fields.forEach(field => {
          sources.push(createDataSource(DATA_SOURCE_TYPES.FORM_FIELD, {
            id: `${form.id}.${field.id}`,
            formId: form.id,
            fieldId: field.id,
            displayName: `${form.data?.name || form.id} → ${field.name}`,
            category: 'Transitive Dependency',
            metadata: {
              formName: form.data?.name || form.id,
              fieldName: field.name,
              fieldType: field.type
            }
          }));
        });
      });
      
      return sources;
    }
  });

  dataSourceRegistry.set(DATA_SOURCE_TYPES.GLOBAL, {
    name: 'Global Data',
    getAvailableSources: (context) => {
      return [
        createDataSource(DATA_SOURCE_TYPES.GLOBAL, {
          id: 'user_email',
          displayName: 'User Email',
          category: 'User Profile',
          metadata: { fieldType: 'email' }
        }),
        createDataSource(DATA_SOURCE_TYPES.GLOBAL, {
          id: 'user_name',
          displayName: 'User Name',
          category: 'User Profile',
          metadata: { fieldType: 'text' }
        }),
        createDataSource(DATA_SOURCE_TYPES.GLOBAL, {
          id: 'org_name',
          displayName: 'Organization Name',
          category: 'Organization',
          metadata: { fieldType: 'text' }
        })
      ];
    }
  });

  dataSourceRegistry.set(DATA_SOURCE_TYPES.URL_PARAM, {
    name: 'URL Parameters',
    getAvailableSources: (context) => {
      const urlParams = new URLSearchParams(window.location.search);
      const sources = [];
      
      for (let [key, value] of urlParams) {
        sources.push(createDataSource(DATA_SOURCE_TYPES.URL_PARAM, {
          id: key,
          displayName: `URL Param: ${key}`,
          category: 'URL Parameters',
          metadata: { fieldType: 'text' },
          getValue: () => value
        }));
      }
      
      return sources;
    }
  });

  // Step 8.3: Source Resolution
  const resolveDataSource = (mapping, context) => {
    if (!mapping) return null;
    
    const provider = dataSourceRegistry.get(mapping.sourceType);
    if (!provider) {
      console.warn(`Unknown data source type: ${mapping.sourceType}`);
      return null;
    }
    
    switch (mapping.sourceType) {
      case DATA_SOURCE_TYPES.FORM_FIELD:
        return {
          value: `Value from ${mapping.sourceFormName}.${mapping.sourceFieldName}`,
          source: mapping
        };
        
      case DATA_SOURCE_TYPES.GLOBAL:
        const globalValues = {
          user_email: 'patient@example.com',
          user_name: 'John Smith',
          org_name: 'City Medical Center'
        };
        return {
          value: globalValues[mapping.globalId] || null,
          source: mapping
        };
        
      case DATA_SOURCE_TYPES.URL_PARAM:
        const urlParams = new URLSearchParams(window.location.search);
        return {
          value: urlParams.get(mapping.paramKey) || null,
          source: mapping
        };
        
      default:
        return null;
    }
  };

  const getAllAvailableSources = (context) => {
    const allSources = [];
    
    dataSourceRegistry.forEach((provider, type) => {
      try {
        const sources = provider.getAvailableSources(context);
        allSources.push({
          type,
          name: provider.name,
          sources
        });
      } catch (error) {
        console.error(`Error getting sources from ${type}:`, error);
        showNotification(`Error loading ${provider.name} sources`, 'error');
      }
    });
    
    return allSources;
  };

  const getPrefillDisplay = (formId, fieldId) => {
    const mapping = prefillMappings[formId]?.[fieldId];
    if (!mapping) return null;
    
    if (mapping.sourceType === DATA_SOURCE_TYPES.FORM_FIELD) {
      return `← ${mapping.sourceFormName || 'Unknown Form'}`;
    }
    
    if (mapping.sourceType === DATA_SOURCE_TYPES.GLOBAL) {
      return `← ${mapping.sourceName || 'Global Data'}`;
    }
    
    if (mapping.sourceType === DATA_SOURCE_TYPES.URL_PARAM) {
      return `← URL: ${mapping.paramKey}`;
    }
    
    return '← Unknown source';
  };

  // Step 8.4: Configuration Structure
  const createPrefillMapping = (fieldId, sourceSelection) => {
    const baseMapping = {
      targetFieldId: fieldId,
      sourceType: sourceSelection.type,
      createdAt: new Date().toISOString(),
      transform: null,
      condition: null,
      fallback: null
    };
    
    switch (sourceSelection.type) {
      case DATA_SOURCE_TYPES.FORM_FIELD:
        return {
          ...baseMapping,
          sourceFormId: sourceSelection.formId,
          sourceFieldId: sourceSelection.fieldId,
          sourceFormName: sourceSelection.formName,
          sourceFieldName: sourceSelection.fieldName,
          sourceFieldType: sourceSelection.fieldType
        };
        
      case DATA_SOURCE_TYPES.GLOBAL:
        return {
          ...baseMapping,
          globalId: sourceSelection.globalId,
          sourceName: sourceSelection.globalName,
          sourceFieldType: sourceSelection.fieldType
        };
        
      case DATA_SOURCE_TYPES.URL_PARAM:
        return {
          ...baseMapping,
          paramKey: sourceSelection.paramKey,
          sourceFieldType: 'text'
        };
        
      default:
        return baseMapping;
    }
  };

  // Step 8.5: Extension Points
  const registerDataSource = (type, provider) => {
    if (dataSourceRegistry.has(type)) {
      console.warn(`Data source ${type} already registered. Overwriting...`);
    }
    dataSourceRegistry.set(type, provider);
  };

  const validationRules = new Map();
  const registerValidation = (sourceType, validator) => {
    validationRules.set(sourceType, validator);
  };

  const sourceUIComponents = new Map();
  const registerSourceUI = (type, component) => {
    sourceUIComponents.set(type, component);
  };

  const prefillSystemConfig = {
    sources: dataSourceRegistry,
    validators: validationRules,
    ui: sourceUIComponents,
    
    addSourceType: (type, config) => {
      DATA_SOURCE_TYPES[type.toUpperCase()] = type;
      if (config.provider) registerDataSource(type, config.provider);
      if (config.validator) registerValidation(type, config.validator);
      if (config.ui) registerSourceUI(type, config.ui);
    }
  };

  // Part 9.3: Field Validation
  const validateFieldMapping = (targetField, sourceSelection) => {
    const warnings = [];
    
    if (targetField && sourceSelection) {
      const targetType = targetField.type;
      const sourceType = sourceSelection.fieldType || sourceSelection.metadata?.fieldType;
      
      if (targetType && sourceType) {
        const compatibleTypes = {
          'email': ['email', 'text', 'string', 'short-text'],
          'number': ['number', 'integer', 'float'],
          'date': ['date', 'datetime', 'string'],
          'boolean': ['boolean', 'checkbox'],
          'text': ['text', 'string', 'email', 'url', 'tel', 'short-text'],
          'short-text': ['text', 'string', 'email', 'short-text'],
          'multi-line-text': ['text', 'string', 'multi-line-text']
        };
        
        const targetCompatible = compatibleTypes[targetType] || [targetType];
        if (!targetCompatible.includes(sourceType) && targetType !== sourceType) {
          warnings.push(`Type mismatch: ${sourceType} → ${targetType}`);
        }
      }
    }
    
    return warnings;
  };

  // Part 9.4: Notification System
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Part 9.5: Performance - Load data with error handling
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchGraphData();
        
        if (!data || !data.nodes) {
          throw new Error('Invalid data format received from API');
        }
        
        setGraphData(data);
        showNotification('Patient intake forms loaded successfully');
      } catch (err) {
        setError(err.message || 'Failed to load patient intake data');
        console.error('Error loading graph data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Part 9.5: Persist mappings to localStorage
  useEffect(() => {
    const savedMappings = localStorage.getItem('patientIntakePrefillMappings');
    if (savedMappings) {
      try {
        setPrefillMappings(JSON.parse(savedMappings));
      } catch (e) {
        console.error('Failed to load saved mappings:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (Object.keys(prefillMappings).length > 0) {
      localStorage.setItem('patientIntakePrefillMappings', JSON.stringify(prefillMappings));
    }
  }, [prefillMappings]);

  const getFormFields = (selectedForm, allFormsData) => {
    if (!selectedForm || !allFormsData?.forms) return [];

    const formDefinition = allFormsData.forms.find(form => 
      form.id === selectedForm.data?.component_id
    );
    if (!formDefinition?.field_schema?.properties) return [];

    const fields = Object.entries(formDefinition.field_schema.properties).map(([key, value]) => ({
      id: key,
      name: value.title || key,
      type: value.avantos_type || value.type || 'text',
      format: value.format,
      required: formDefinition.field_schema.required?.includes(key) || false
    }));
    
    return fields;
  };

  const getAccessibleForms = (formId) => {
    if (!graphData?.nodes) {
      return {
        direct: [],
        transitive: []
      };
    }
    
    const directDependencies = new Set();
    const transitiveDependencies = new Set();

    const currentForm = graphData.nodes.find(node => node.id === formId);
    if (!currentForm?.data?.prerequisites) {
      return {
        direct: [],
        transitive: []
      };
    }
    
    currentForm.data.prerequisites.forEach(depId => {
      directDependencies.add(depId);
    });

    const visited = new Set([formId]);
    const queue = [...currentForm.data.prerequisites];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const form = graphData.nodes.find(node => node.id === currentId);
      if (form?.data?.prerequisites) {
        form.data.prerequisites.forEach(depId => {
          if (!visited.has(depId) && !directDependencies.has(depId)) {
            transitiveDependencies.add(depId);
            queue.push(depId);
          }
        });
      }
    }

    const getFormsByIds = (ids) => {
      return Array.from(ids)
        .map(id => graphData.nodes.find(node => node.id === id))
        .filter(Boolean);
    };
    
    return {
      direct: getFormsByIds(directDependencies),
      transitive: getFormsByIds(transitiveDependencies)
    };
  };

  const handleFormClick = (form) => {
    setSelectedForm(form); 
  };

  const handleConfigurePrefill = (fieldId) => {
    setConfiguringField(fieldId);
    setShowPrefillModal(true);
    setSelectedSource(null);
    setFieldValidationWarning(null);
  };

  const handleCloseModal = () => {
    setShowPrefillModal(false);
    setConfiguringField(null);
    setSelectedSource(null);
    setFieldValidationWarning(null);
  };

  const handleSavePrefillMapping = async () => {
    if (!selectedSource || !configuringField || !selectedForm) return;
    
    try {
      setSavingMapping(true);
      
      // Validate before saving
      const targetField = fields.find(f => f.id === configuringField);
      const warnings = validateFieldMapping(targetField, selectedSource);
      
      if (warnings.length > 0 && !fieldValidationWarning) {
        setFieldValidationWarning(warnings.join(', '));
        setSavingMapping(false);
        return;
      }
      
      const mapping = createPrefillMapping(configuringField, selectedSource);
      
      setPrefillMappings(prev => ({
        ...prev,
        [selectedForm.id]: {
          ...prev[selectedForm.id],
          [configuringField]: mapping
        }
      }));
      
      showNotification('Prefill mapping saved successfully');
      handleCloseModal();
    } catch (error) {
      console.error('Error saving mapping:', error);
      showNotification('Failed to save prefill mapping', 'error');
    } finally {
      setSavingMapping(false);
    }
  };

  const hasFieldPrefill = (formId, fieldId) => {
    return prefillMappings[formId]?.[fieldId] !== undefined;
  };

  const removePrefillMapping = (formId, fieldId) => {
    setPrefillMappings(prev => {
      const formMappings = { ...prev[formId] };
      delete formMappings[fieldId];
      return {
        ...prev,
        [formId]: formMappings
      };
    });
    showNotification('Prefill mapping removed');
  };

  // Part 9.2: Loading State
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        backgroundColor: '#f8f9fa'
      }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '20px', color: '#6c757d' }}>Loading patient intake forms...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2 style={{ color: '#d62828' }}>Error Loading Data</h2>
          <p style={{ color: '#6c757d', marginBottom: '20px' }}>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0077b6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const fields = getFormFields(selectedForm, graphData);

  return (
    <div className="App">
      <h1>Patient Intake System</h1>
      
      {/* Part 9.4: Notification Display */}
      {notification && (
        <div 
          className={`notification ${notification.type}`}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            backgroundColor: notification.type === 'error' ? '#d62828' : '#52b788',
            color: 'white',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 2000,
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          {notification.message}
        </div>
      )}
      
      <div className="container">
        <div className="forms-panel">
          <h2>Intake Forms</h2>
          {!graphData?.nodes || graphData.nodes.filter(node => node.type === 'form').length === 0 ? (
            <p style={{ color: '#6c757d', textAlign: 'center', padding: '20px' }}>
              No forms available
            </p>
          ) : (
            graphData.nodes
              .filter(node => node.type === 'form')
              .map(form => (
                <div 
                  key={form.id} 
                  className={`form-card ${selectedForm?.id === form.id ? 'selected' : ''}`}
                  onClick={() => handleFormClick(form)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => e.key === 'Enter' && handleFormClick(form)}
                >
                  <h3>{form.data?.name || form.id}</h3>
                  <p>Type: {form.type}</p>
                  {form.data?.prerequisites && form.data.prerequisites.length > 0 && (
                    <p>Dependencies: {form.data.prerequisites.length}</p>
                  )}
                </div>
              ))
          )}
        </div>
        
        <div className="config-panel">
          <h2>Form Configuration</h2>
          {selectedForm ? (
            <div>
              <h3>Selected: {selectedForm.data?.name}</h3>
              <p><strong>Form ID:</strong> {selectedForm.id}</p>
              <p><strong>Type:</strong> {selectedForm.type}</p>
              
              {selectedForm.data?.prerequisites && selectedForm.data.prerequisites.length > 0 ? (
                <div>
                  <p><strong>Dependencies ({selectedForm.data.prerequisites.length}):</strong></p>
                  <ul>
                    {selectedForm.data.prerequisites.map(dep => (
                      <li key={dep}>{dep}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p><strong>Dependencies:</strong> None (root form)</p>
              )}

              <div className="fields-section">
                <h4>Form Fields:</h4>
                {fields && fields.length > 0 ? (
                  <div>
                    {fields.map(field => {
                      const hasPrefill = hasFieldPrefill(selectedForm.id, field.id);
                      const prefillText = getPrefillDisplay(selectedForm.id, field.id);
                      
                      return (
                        <div key={field.id} className="field-item">
                          <div className="field-info">
                            <span className="field-name">{field.name}</span>
                            <span className="field-type">({field.type})</span>
                            {field.required && <span className="field-required">*</span>}
                            {hasPrefill && (
                              <div className="field-prefill-status">
                                {prefillText}
                              </div>
                            )}
                          </div>
                          <div className="field-actions">
                            {hasPrefill ? (
                              <div className="prefill-actions">
                                <button 
                                  className="btn-edit-prefill"
                                  onClick={() => handleConfigurePrefill(field.id)}
                                >
                                  Edit
                                </button>
                                <button 
                                  className="btn-remove-prefill"
                                  onClick={() => removePrefillMapping(selectedForm.id, field.id)}
                                  aria-label="Remove prefill mapping"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <button 
                                className="btn-configure"
                                onClick={() => handleConfigurePrefill(field.id)}
                              >
                                Configure Prefill
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="no-fields">No fields found for this form</p>
                )}
              </div>
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px',
              color: '#6c757d'
            }}>
              <p>Select a form to configure prefill mappings</p>
            </div>
          )}
        </div>
      </div>
      
      {showPrefillModal && (
        <>
          <div 
            className="modal-backdrop"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={handleCloseModal}
          />
        
          <div 
            className="modal"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              zIndex: 1001,
              minWidth: '500px',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'auto',
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            <h3 style={{ marginTop: 0, color: '#0077b6' }}>Configure Prefill</h3>
            <p>Select a source for field: <strong>{configuringField}</strong></p>
            
            {/* Part 9.3: Validation Warning */}
            {fieldValidationWarning && (
              <div style={{
                padding: '12px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '4px',
                marginBottom: '15px',
                color: '#856404'
              }}>
                <strong>⚠️ Warning:</strong> {fieldValidationWarning}
                <br />
                <small>Click Save again to proceed anyway.</small>
              </div>
            )}
            
            <div style={{ marginTop: '20px' }}>
              {(() => {
                const context = {
                  selectedForm,
                  graphData,
                  getAccessibleForms,
                  getFormFields
                };
                
                const allSourceGroups = getAllAvailableSources(context);
                
                if (allSourceGroups.length === 0) {
                  return (
                    <p style={{ color: '#6c757d', textAlign: 'center' }}>
                      No data sources available
                    </p>
                  );
                }
                
                return (
                  <>
                    {allSourceGroups.map(group => {
                      if (group.type === DATA_SOURCE_TYPES.FORM_FIELD) {
                        const directSources = group.sources.filter(s => s.category === 'Direct Dependency');
                        const transitiveSources = group.sources.filter(s => s.category === 'Transitive Dependency');
                        
                        return (
                          <React.Fragment key={group.type}>
                            {directSources.length > 0 && (
                              <div style={{ marginBottom: '20px' }}>
                                <h4 style={{ marginBottom: '10px', color: '#212529' }}>Direct Dependencies</h4>
                                <div style={{ paddingLeft: '10px' }}>
                                  {(() => {
                                    const formGroups = {};
                                    directSources.forEach(source => {
                                      const formId = source.formId;
                                      if (!formGroups[formId]) {
                                        formGroups[formId] = {
                                          form: source.metadata.formName,
                                          fields: []
                                        };
                                      }
                                      formGroups[formId].fields.push(source);
                                    });
                                    
                                    return Object.entries(formGroups).map(([formId, group]) => (
                                      <div 
                                        key={formId}
                                        style={{ 
                                          padding: '10px',
                                          margin: '5px 0',
                                          backgroundColor: '#f5f5f5',
                                          borderRadius: '4px'
                                        }}
                                      >
                                        <strong>{group.form}</strong>
                                        <div style={{ marginTop: '8px', paddingLeft: '20px' }}>
                                          {group.fields.map(source => (
                                            <div
                                              key={source.id}
                                              style={{
                                                padding: '8px 12px',
                                                margin: '3px 0',
                                                backgroundColor: selectedSource?.formId === source.formId && selectedSource?.fieldId === source.fieldId 
                                                  ? '#0077b6' 
                                                  : 'white',
                                                color: selectedSource?.formId === source.formId && selectedSource?.fieldId === source.fieldId 
                                                  ? 'white' 
                                                  : 'black',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                border: '1px solid #ddd',
                                                transition: 'all 0.2s ease'
                                              }}
                                              onClick={() => {
                                                setSelectedSource({
                                                  type: DATA_SOURCE_TYPES.FORM_FIELD,
                                                  formId: source.formId,
                                                  fieldId: source.fieldId,
                                                  formName: source.metadata.formName,
                                                  fieldName: source.metadata.fieldName,
                                                  fieldType: source.metadata.fieldType,
                                                  metadata: source.metadata
                                                });
                                                setFieldValidationWarning(null);
                                              }}
                                              onMouseEnter={(e) => {
                                                if (selectedSource?.formId !== source.formId || selectedSource?.fieldId !== source.fieldId) {
                                                  e.currentTarget.style.backgroundColor = '#e9ecef';
                                                }
                                              }}
                                              onMouseLeave={(e) => {
                                                if (selectedSource?.formId !== source.formId || selectedSource?.fieldId !== source.fieldId) {
                                                  e.currentTarget.style.backgroundColor = 'white';
                                                }
                                              }}
                                            >
                                              {source.metadata.fieldName} <span style={{ opacity: 0.7 }}>({source.metadata.fieldType})</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              </div>
                            )}
                            
                            {transitiveSources.length > 0 && (
                              <div style={{ marginBottom: '20px' }}>
                                <h4 style={{ marginBottom: '10px', color: '#212529' }}>Transitive Dependencies</h4>
                                <div style={{ paddingLeft: '10px' }}>
                                  {(() => {
                                    const formGroups = {};
                                    transitiveSources.forEach(source => {
                                      const formId = source.formId;
                                      if (!formGroups[formId]) {
                                        formGroups[formId] = {
                                          form: source.metadata.formName,
                                          fields: []
                                        };
                                      }
                                      formGroups[formId].fields.push(source);
                                    });
                                    
                                    return Object.entries(formGroups).map(([formId, group]) => (
                                      <div 
                                        key={formId}
                                        style={{ 
                                          padding: '10px',
                                          margin: '5px 0',
                                          backgroundColor: '#f5f5f5',
                                          borderRadius: '4px'
                                        }}
                                      >
                                        <strong>{group.form}</strong>
                                        <div style={{ marginTop: '8px', paddingLeft: '20px' }}>
                                          {group.fields.map(source => (
                                            <div
                                              key={source.id}
                                              style={{
                                                padding: '8px 12px',
                                                margin: '3px 0',
                                                backgroundColor: selectedSource?.formId === source.formId && selectedSource?.fieldId === source.fieldId 
                                                  ? '#0077b6' 
                                                  : 'white',
                                                color: selectedSource?.formId === source.formId && selectedSource?.fieldId === source.fieldId 
                                                  ? 'white' 
                                                  : 'black',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                border: '1px solid #ddd',
                                                transition: 'all 0.2s ease'
                                              }}
                                              onClick={() => {
                                                setSelectedSource({
                                                  type: DATA_SOURCE_TYPES.FORM_FIELD,
                                                  formId: source.formId,
                                                  fieldId: source.fieldId,
                                                  formName: source.metadata.formName,
                                                  fieldName: source.metadata.fieldName,
                                                  fieldType: source.metadata.fieldType,
                                                  metadata: source.metadata
                                                });
                                                setFieldValidationWarning(null);
                                              }}
                                              onMouseEnter={(e) => {
                                                if (selectedSource?.formId !== source.formId || selectedSource?.fieldId !== source.fieldId) {
                                                  e.currentTarget.style.backgroundColor = '#e9ecef';
                                                }
                                              }}
                                              onMouseLeave={(e) => {
                                                if (selectedSource?.formId !== source.formId || selectedSource?.fieldId !== source.fieldId) {
                                                  e.currentTarget.style.backgroundColor = 'white';
                                                }
                                              }}
                                            >
                                              {source.metadata.fieldName} <span style={{ opacity: 0.7 }}>({source.metadata.fieldType})</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      } else {
                        if (group.sources.length === 0) return null;
                        
                        return (
                          <div key={group.type} style={{ marginBottom: '20px' }}>
                            <h4 style={{ marginBottom: '10px', color: '#212529' }}>{group.name}</h4>
                            <div style={{ paddingLeft: '10px' }}>
                              {group.sources.map(source => (
                                <div
                                  key={source.id}
                                  style={{ 
                                    padding: '10px',
                                    margin: '5px 0',
                                    backgroundColor: selectedSource?.type === source.type && selectedSource?.globalId === source.id
                                      ? '#0077b6'
                                      : '#f5f5f5',
                                    color: selectedSource?.type === source.type && selectedSource?.globalId === source.id
                                      ? 'white'
                                      : 'black',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onClick={() => {
                                    setSelectedSource({
                                      type: source.type,
                                      globalId: source.id,
                                      globalName: source.displayName,
                                      fieldType: source.metadata?.fieldType,
                                      metadata: source.metadata
                                    });
                                    setFieldValidationWarning(null);
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!(selectedSource?.type === source.type && selectedSource?.globalId === source.id)) {
                                      e.currentTarget.style.backgroundColor = '#e9ecef';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!(selectedSource?.type === source.type && selectedSource?.globalId === source.id)) {
                                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                                    }
                                  }}
                                >
                                  {source.displayName}
                                  {source.category && (
                                    <span style={{ opacity: 0.7, fontSize: '12px' }}> - {source.category}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                    })}
                  </>
                );
              })()}
            </div>
            
            <div style={{ 
              marginTop: '30px', 
              display: 'flex', 
              gap: '10px', 
              justifyContent: 'flex-end',
              borderTop: '1px solid #dee2e6',
              paddingTop: '20px'
            }}>
              <button 
                onClick={handleCloseModal}
                style={{
                  padding: '10px 20px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSavePrefillMapping}
                disabled={!selectedSource || savingMapping}
                style={{
                  backgroundColor: selectedSource ? '#0077b6' : '#ccc',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: selectedSource && !savingMapping ? 'pointer' : 'not-allowed',
                  opacity: savingMapping ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                  minWidth: '80px'
                }}
                onMouseEnter={(e) => {
                  if (selectedSource && !savingMapping) {
                    e.currentTarget.style.backgroundColor = '#005f8a';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedSource) {
                    e.currentTarget.style.backgroundColor = '#0077b6';
                  }
                }}
              >
                {savingMapping ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Part 9.1: Wrap App with Error Boundary
export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}