import fetch from 'node-fetch'

export async function get_instagram(access_token) {
    const endpoint = "https://graph.facebook.com/v18.0/";
    const input_data = "me/accounts?fields=instagram_business_account{id,name,username,profile_picture_url}";
    const response = await fetch(`${endpoint}${input_data}&access_token=${access_token}`);
    return response.json();
}

export async function is_ig_access_token_valid(access_token) {
    const endpoint = `https://graph.facebook.com/v18.0/me/accounts?access_token=${access_token}`;
    const response = await fetch(endpoint);
    const jsonResponse = await response.json();
    return !jsonResponse.error;
}

export async function post_image_to_instagram(access_token, ig_business_user_id, image_url, caption) {
    try {
        // Create container
        let endpoint = `https://graph.facebook.com/v18.0/${ig_business_user_id}/media`;
        let data = {
            image_url,
            caption,
            access_token,
        };
        let response = await fetch(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' },
        });
        const containerResponse = await response.json();

        const container_id = containerResponse.id;

        // Publish container
        endpoint = `https://graph.facebook.com/v18.0/${ig_business_user_id}/media_publish`;
        data = {
            creation_id: container_id,
            access_token,
        };
        response = await fetch(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' },
        });

        const publishResponse = await response.json();
        return publishResponse.id;
    } catch (error) {
        console.error(error);
    }
}

export async function post_reel_to_instagram(access_token, ig_business_user_id, video_url, caption, collaborators = null) {
    try {
        // Create container
        let endpoint = `https://graph.facebook.com/v18.0/${ig_business_user_id}/media`;
        let data = {
            video_url,
            media_type: "REELS",
            caption,
            access_token,
        };
        if (collaborators) {
            data.collaborators = collaborators;
        }
        let response = await fetch(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' },
        });
        const containerResponse = await response.json();

        if (containerResponse.error) {
            throw new Error(containerResponse.error.message);
        }

        const container_id = containerResponse.id;

        // Publish container
        while (true) {
            endpoint = `https://graph.facebook.com/v18.0/${ig_business_user_id}/media_publish`;
            data = {
                creation_id: container_id,
                access_token,
            };
            response = await fetch(endpoint, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'application/json' },
            });

            const publishResponse = await response.json();
            if (publishResponse.error) {
                if (publishResponse.error.code === 9007 && publishResponse.error.error_subcode === 2207027) {
                    console.log("Waiting to publish reel...");
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                } else {
                    throw new Error(publishResponse.error.message);
                }
            } else {
                return publishResponse.id;
            }
        }
    } catch (error) {
        console.error(error);
    }
}

export async function post_story_to_instagram(access_token, ig_business_user_id, video_url = null, image_url = null) {
    try {
        // Create container
        let endpoint = `https://graph.facebook.com/v18.0/${ig_business_user_id}/media`;
        let data = {
            media_type: "STORIES",
            access_token,
        };
        if (video_url) {
            data.video_url = video_url;
        } else if (image_url) {
            data.image_url = image_url;
        }

        let response = await fetch(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' },
        });
        const containerResponse = await response.json();

        if (containerResponse.error) {
            throw new Error(containerResponse.error.message);
        }

        const container_id = containerResponse.id;

        // Publish container
        while (true) {
            endpoint = `https://graph.facebook.com/v18.0/${ig_business_user_id}/media_publish`;
            data = {
                creation_id: container_id,
                access_token,
            };
            response = await fetch(endpoint, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'application/json' },
            });

            const publishResponse = await response.json();
            if (publishResponse.error) {
                if (publishResponse.error.code === 9007 && publishResponse.error.error_subcode === 2207027) {
                    console.log("Waiting to publish story...");
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                } else {
                    throw new Error(publishResponse.error.message);
                }
            } else {
                return publishResponse.id;
            }
        }
    } catch (error) {
        console.error(error);
    }
}
