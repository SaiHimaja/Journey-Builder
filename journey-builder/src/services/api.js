const API_BASE_URL = 'http://localhost:3000'
const API_END_POINT = '/api/v1/123/actions/blueprints/bp_456/graph'

export const fetchGraphData = async () => {
    const response = await fetch(`${API_BASE_URL}${API_END_POINT}`)

    if (!response.ok){
        throw new Error(`Falied to fetch data :${response.status}`)
    }

    const data = await response.json()
    return data;
}