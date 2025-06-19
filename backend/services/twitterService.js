const axios = require('axios');

/**
 * Get a user's home feed from Twitter/X
 * @param {string} username - The username of the user
 * @param {string} token - The user's authentication token
 * @returns {Object} The user's home feed
 */
exports.getHomeFeed = async (username, token) => {
  try {
    console.log(`Preparing request for user: ${username}`);
    
    // Parse the token if it's a string
    const cookiesObj = typeof token === 'string' ? JSON.parse(token) : token;
    
    // Create cookie string - include ALL cookies from the user
    const cookieString = `auth_token=${cookiesObj.auth_token}; ct0=${cookiesObj.ct0}`;
    
    // 2025 Twitter requires these specific headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Authorization': `Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`,
      'Cookie': cookieString,
      'X-CSRF-Token': cookiesObj.ct0,
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-client-language': 'en',
      'x-twitter-active-user': 'yes',
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Origin': 'https://twitter.com',
      'Referer': 'https://twitter.com/home'
    };
    
    console.log('Making API request to Twitter for home timeline');
    
    // Use the latest GraphQL endpoint (updated for 2025)
    const response = await axios({
      method: 'get',
      url: 'https://twitter.com/i/api/graphql/PqmD7oMc-XD4QJjfwFh-aw/HomeLatestTimeline',
      params: {
        variables: JSON.stringify({
          count: 40,
          includePromotedContent: false,
          latestControlAvailable: true,
          requestContext: "launch"
        }),
        features: JSON.stringify({
          responsive_web_graphql_exclude_directive_enabled: true,
          verified_phone_label_enabled: false,
          creator_subscriptions_tweet_preview_api_enabled: true,
          responsive_web_graphql_timeline_navigation_enabled: true,
          responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
          tweetypie_unmention_optimization_enabled: true,
          responsive_web_edit_tweet_api_enabled: true,
          graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
          view_counts_everywhere_api_enabled: true,
          longform_notetweets_consumption_enabled: true,
          tweet_awards_web_tipping_enabled: false,
          freedom_of_speech_not_reach_fetch_enabled: true,
          standardized_nudges_misinfo: true,
          tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
          longform_notetweets_rich_text_read_enabled: true,
          longform_notetweets_inline_media_enabled: true,
          responsive_web_media_download_video_enabled: false,
          responsive_web_enhance_cards_enabled: false
        })
      },
      headers: headers
    });
    
    console.log(`Received response from Twitter API with status: ${response.status}`);
    
    // Process and return the tweets
    // This handles the 2025 Twitter response format
    const timelineEntries = response.data.data.home.home_timeline_urt.instructions
      .find(i => i.type === 'TimelineAddEntries')?.entries || [];
    
    const tweets = [];
    
    for (const entry of timelineEntries) {
      // Only process tweet entries
      if (entry.content && entry.content.entryType === 'TimelineTimelineItem' && 
          entry.content.itemContent && entry.content.itemContent.tweet_results) {
        
        const tweetResult = entry.content.itemContent.tweet_results.result;
        if (!tweetResult) continue;
        
        // Skip non-tweet entries
        if (tweetResult.__typename !== 'Tweet') continue;
        
        const tweet = tweetResult.legacy;
        const user = tweetResult.core?.user_results?.result?.legacy;
        
        if (!tweet || !user) continue;
        
        tweets.push({
          id: tweet.id_str,
          text: tweet.full_text || tweet.text,
          created_at: tweet.created_at,
          author: {
            id: user.id_str,
            name: user.name,
            username: user.screen_name,
            profile_image_url: user.profile_image_url_https
          },
          reply_count: tweet.reply_count,
          retweet_count: tweet.retweet_count,
          favorite_count: tweet.favorite_count,
          media_url: tweet.entities.media && tweet.entities.media.length > 0 
            ? tweet.entities.media[0].media_url_https 
            : null
        });
      }
    }
    
    console.log(`Processed ${tweets.length} tweets from response`);
    return { tweets };
  } catch (error) {
    console.error('Error fetching home feed:', 
      error.response ? `Status: ${error.response.status}` : error.message);
    console.error('Error details:', error.response?.data || error.message);
    
    // Handle specific error types
    if (error.response && error.response.status === 401) {
      throw new Error('authentication failed');
    }
    
    if (error.response && error.response.status === 429) {
      throw new Error('rate limit exceeded');
    }
    
    throw new Error(`Failed to fetch Twitter feed: ${error.message}`);
  }
};

/**
 * Verify a token with Twitter - 2025 version with new endpoint
 * @param {string} token - The token to verify
 * @returns {boolean} Whether the token is valid
 */
exports.verifyToken = async (token) => {
  try {
    // Parse the token if it's a string
    const cookiesObj = typeof token === 'string' ? JSON.parse(token) : token;
    
    // Create cookie string
    const cookieString = `auth_token=${cookiesObj.auth_token}; ct0=${cookiesObj.ct0}`;
    
    // Create headers with the necessary cookies and headers for 2025
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Authorization': `Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`,
      'Cookie': cookieString,
      'X-CSRF-Token': cookiesObj.ct0,
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-client-language': 'en',
      'x-twitter-active-user': 'yes',
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Origin': 'https://twitter.com',
      'Referer': 'https://twitter.com/home'
    };
    
    console.log('Validating token with Twitter API (June 2025 method)');
    
    // Use the home timeline GraphQL endpoint to verify token
    // This is more reliable than the account/settings endpoint that's now deprecated
    const response = await axios({
      method: 'get',
      url: 'https://twitter.com/i/api/graphql/PqmD7oMc-XD4QJjfwFh-aw/HomeLatestTimeline',
      params: {
        variables: JSON.stringify({
          count: 1, // Just request 1 tweet to minimize data transfer
          includePromotedContent: false,
          latestControlAvailable: true,
          requestContext: "launch"
        }),
        features: JSON.stringify({
          responsive_web_graphql_exclude_directive_enabled: true,
          verified_phone_label_enabled: false,
          creator_subscriptions_tweet_preview_api_enabled: true,
          responsive_web_graphql_timeline_navigation_enabled: true,
          responsive_web_graphql_skip_user_profile_image_extensions_enabled: false
        })
      },
      headers: headers
    });
    
    console.log(`Validation response status: ${response.status}`);
    
    // If we get a 200 response, the token is valid
    return response.status === 200;
  } catch (error) {
    console.error('Error verifying token:', 
      error.response ? `Status: ${error.response.status}` : error.message);
    console.error('Error details:', error.response?.data || error.message);
    return false;
  }
};
