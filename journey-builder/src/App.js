import React, { useState, useEffect } from 'react';
import { fetchGraphData } from './services/api';  
import './App.css';

function App() {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedForm, setSelectedForm] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchGraphData();
        setGraphData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getFormFields = (selectedForm, allFormsData) =>{
    if (!selectedForm || !allFormsData ?.forms)return[];

    const formDefinition = allFormsData.forms.find(form => 
      form.id ===selectedForm.data?.component_id
    )
    if (!formDefinition?.field_schema?.properties)return[];

    const fields = Object.entries(formDefinition.field_schema.properties).map(([key, value]) => ({

      id:key,
      name: value.title || key,
      type: value.avantos_type || value.type || 'text',
      format: value.format,
      required: formDefinition.field_schema.required?.includes(key) || false

    })

    )
    return fields;
  }

  const handleFormClick = (form) => {
    setSelectedForm(form); 
    console.log('Selected Form:', form);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="App">
      <h1>Journey Builder</h1>
      
      <div className="container">
        <div className="forms-panel">
          <h2>Forms</h2>
          {graphData.nodes && graphData.nodes
            .filter(node => node.type === 'form')
            .map(form => (
              <div 
                key={form.id} 
                className={`form-card ${selectedForm?.id === form.id ? 'selected' : ''}`}
                onClick={() => handleFormClick(form)}
              >
                <h3>{form.data?.name || form.id}</h3>
                <p>Type: {form.type}</p>
                {form.data?.prerequisites && form.data.prerequisites.length > 0 && (
                  <p>Dependencies: {form.data.prerequisites.length}</p>
                )}
              </div>
            ))
          }
        </div>
        
        <div className="config-panel">
          <h2>Configuration Panel</h2>
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
              <h4> Form Fields:</h4>
              {(()=>{
                const fields = getFormFields(selectedForm,graphData);
                return fields.length >0 ?(
                  <div className="fields-list">
                    {
                      fields.map(field => (
                        <div key= {field.id} className="field-item">
                          <div className="field-info">
                            <span className="field-name">{field.name}</span>
                            <span className="field-type">{field.type}</span>
                            {field.required && <span className="field-required">*</span>}

                          </div>
                          <div className= "field-actions">
                            <button className="btn-configure">Configure Prefill</button>
                          </div>
                        </div>
                      ))}
                      </div>
                ):(
                  <p className="no-fields">No fields found for this form</p>
                );
                
              })()}


              </div>
            </div>
          ) : (
            <p>Select a form to configure</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;