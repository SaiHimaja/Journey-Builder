// services/api.js
const API_BASE_URL = 'http://localhost:3001'
const API_END_POINT = '/api/v1/clinic/intake/workflow/graph'

export const fetchGraphData = async () => {
    const response = await fetch(`${API_BASE_URL}${API_END_POINT}`)

    if (!response.ok){
        throw new Error(`Failed to fetch data: ${response.status}`)
    }

    const data = await response.json()
    return data;
}