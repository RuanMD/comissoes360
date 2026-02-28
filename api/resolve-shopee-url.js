export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { shortUrl } = req.body;

    if (!shortUrl) {
        return res.status(400).json({ error: 'shortUrl is required' });
    }

    try {
        const response = await fetch(shortUrl, { redirect: 'manual' });
        const location = response.headers.get('location');

        if (!location) {
            return res.status(400).json({ error: 'Não foi possível resolver o link. Nenhum redirect encontrado.' });
        }

        return res.status(200).json({ resolvedUrl: location });
    } catch (error) {
        console.error('URL resolve failed:', error);
        return res.status(500).json({ error: 'Erro ao resolver URL encurtada.' });
    }
}
