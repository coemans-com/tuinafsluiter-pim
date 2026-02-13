
import { getSupabase } from './supabaseClient';
import { Product, ProductType, User, LogEntry, LogType, AppSettings, PriceList } from '../types';
import { DEFAULT_FORMULA_B2B, DEFAULT_FORMULA_CONSUMER } from '../utils/pricing';

// --- HELPER FUNCTIONS ---

const mapProductFromDB = (row: any, bomEntries: any[]): Product => {
    const productBom = bomEntries
        .filter(b => b.parent_id === row.id)
        .map(b => ({
            componentId: b.component_id,
            quantity: b.quantity
        }));

    let mappedType = row.type;
    if (mappedType === 'product' || !mappedType) {
        mappedType = ProductType.SIMPLE;
    }

    return {
        id: row.id,
        sku: row.sku,
        name: row.name,
        type: mappedType as ProductType,
        purchaseCost: Number(row.purchase_cost),
        prices: row.prices || [],
        teamleaderId: row.teamleader_id,
        needsSync: row.needs_sync,
        lastSync: row.last_sync,
        lastEdited: row.last_edited,
        bom: productBom
    };
};

// Generic invoker for the PHP proxy (hosted on Combell)
async function invokeEdgeFunction(payload: any) {
    // We target the PHP script at the root
    const PROXY_URL = 'proxy.php';

    console.log("[API] Invoking Proxy (PHP) with payload:", payload);

    try {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // Parse Text first to handle potential PHP errors (like warnings printed before JSON)
        const text = await response.text();
        let data;
        
        try {
            // Attempt to find the JSON object if there's garbage before/after
            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = text.substring(jsonStart, jsonEnd + 1);
                data = JSON.parse(jsonStr);
            } else {
                data = JSON.parse(text);
            }
        } catch (e) {
            console.error("Proxy returned non-JSON:", text);
            throw new Error(`Proxy Error: Server returned invalid JSON. Check PHP logs.`);
        }

        // Check for application-level errors returned by the function (even if HTTP 200)
        if (data && (data.error || (data.upstreamStatus && data.upstreamStatus >= 400))) {
             console.warn("[API] Proxy returned application error:", data);
             
             const msg = typeof data.error === 'string' ? data.error : 
                         (data.error?.error || data.error?.message || JSON.stringify(data.error));
             
             const e: any = new Error(msg || `Upstream Error ${data.upstreamStatus}`);
             e.status = data.upstreamStatus;
             throw e;
        }

        return data;

    } catch (error: any) {
        console.error("Proxy Invocation Error:", error);
        throw error;
    }
}

// --- API EXPORTS ---

export const api = {
    // ----------------------------
    // DATA ACCESS
    // ----------------------------
    async fetchProducts() {
        const supabase = getSupabase();
        if (!supabase) throw new Error("Supabase not configured");

        const { data: productsData, error: prodError } = await supabase.from('products').select('*');
        if (prodError) throw prodError;

        const { data: bomData, error: bomError } = await supabase.from('bom_entries').select('*');
        if (bomError) throw bomError;

        const products = productsData.map((p: any) => mapProductFromDB(p, bomData || []));
        return products as Product[];
    },

    async saveProduct(product: Product) {
        const supabase = getSupabase();
        if (!supabase) return;

        const { error: prodError } = await supabase.from('products').upsert({
            id: product.id,
            sku: product.sku,
            name: product.name,
            type: product.type,
            purchase_cost: product.purchaseCost,
            prices: product.prices,
            teamleader_id: product.teamleaderId,
            needs_sync: product.needsSync,
            last_sync: product.lastSync,
            last_edited: product.lastEdited
        });

        if (prodError) throw prodError;

        if (product.type === ProductType.COMPOSITE) {
            await supabase.from('bom_entries').delete().eq('parent_id', product.id);

            if (product.bom && product.bom.length > 0) {
                const bomRows = product.bom.map(b => ({
                    parent_id: product.id,
                    component_id: b.componentId,
                    quantity: b.quantity
                }));
                const { error: bomError } = await supabase.from('bom_entries').insert(bomRows);
                if (bomError) throw bomError;
            }
        }
    },

    async deleteProduct(id: string) {
        const supabase = getSupabase();
        if (!supabase) return;
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
    },

    async bulkSaveProducts(products: Product[]) {
        for (const p of products) {
            await this.saveProduct(p);
        }
    },

    // ----------------------------
    // USERS / AUTH
    // ----------------------------
    async login(email: string, password: string): Promise<User | null> {
        const supabase = getSupabase();
        if (!supabase) throw new Error("Database not connected");

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError || !authData.user) throw new Error(authError?.message || "Login failed");

        try {
            const { data: profile } = await supabase.from('users').select('*').eq('id', authData.user.id).single();
            if (profile) return { id: profile.id, email: profile.email, name: profile.name, role: profile.role };
        } catch (e) {
            console.warn("Database profile fetch failed, using fallback.", e);
        }
        return { id: authData.user.id, email: authData.user.email || '', name: 'Fallback Admin', role: 'admin' };
    },

    async logout() {
        const supabase = getSupabase();
        if (supabase) await supabase.auth.signOut();
    },

    async getCurrentSession(): Promise<User | null> {
        const supabase = getSupabase();
        if (!supabase) return null;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;
        try {
            const { data: profile } = await supabase.from('users').select('*').eq('id', session.user.id).single();
            return { id: session.user.id, email: session.user.email || '', name: profile?.name || session.user.email || 'User', role: profile?.role || 'viewer' };
        } catch(e) {
             return { id: session.user.id, email: session.user.email || '', name: 'Fallback User', role: 'admin' };
        }
    },

    async fetchUsers(): Promise<User[]> {
        const supabase = getSupabase();
        if (!supabase) return [];
        const { data, error } = await supabase.from('users').select('id, email, name, role');
        if (error) throw error;
        return data as User[];
    },

    async addUser(user: User) {
        const supabase = getSupabase();
        if (!supabase) return;
        const { error } = await supabase.rpc('create_user_by_admin', { new_email: user.email, new_password: user.password, new_name: user.name, new_role: user.role });
        if (error) throw error;
    },

    async resetUserPassword(email: string, newPassword: string) {
        const supabase = getSupabase();
        if (!supabase) return;
        const { error } = await supabase.rpc('reset_password_by_admin', { target_email: email, new_password: newPassword });
        if (error) throw error;
    },

    async deleteUser(id: string) {
        const supabase = getSupabase();
        if (!supabase) return;
        const { error } = await supabase.rpc('delete_user_by_admin', { target_id: id });
        if (error) await supabase.from('users').delete().eq('id', id);
    },

    // ----------------------------
    // SETTINGS
    // ----------------------------
    async getAppSettings(): Promise<AppSettings> {
        const supabase = getSupabase();
        if (!supabase) return { priceFormulaB2B: DEFAULT_FORMULA_B2B, priceFormulaConsumer: DEFAULT_FORMULA_CONSUMER, language: 'en' };

        const { data, error } = await supabase
            .from('integrations')
            .select('settings')
            .eq('service', 'app_settings')
            .single();

        if (error || !data || !data.settings) {
            return { priceFormulaB2B: DEFAULT_FORMULA_B2B, priceFormulaConsumer: DEFAULT_FORMULA_CONSUMER, language: 'en' };
        }
        
        const settings = data.settings;
        if (settings.priceFormula && !settings.priceFormulaB2B) {
            settings.priceFormulaB2B = settings.priceFormula;
        }

        return {
            priceFormulaB2B: settings.priceFormulaB2B || DEFAULT_FORMULA_B2B,
            priceFormulaConsumer: settings.priceFormulaConsumer || DEFAULT_FORMULA_CONSUMER,
            language: settings.language || 'en'
        };
    },

    async saveAppSettings(settings: AppSettings) {
        const supabase = getSupabase();
        if (!supabase) return;

        const { error } = await supabase
            .from('integrations')
            .upsert({ 
                service: 'app_settings', 
                settings: settings, 
                updated_at: new Date().toISOString() 
            });
        
        if (error) throw error;
    },

    async saveIntegrationSettings(service: string, settings: any) {
        const supabase = getSupabase();
        if (!supabase) return;
        const { error } = await supabase.from('integrations').upsert({ service, settings, updated_at: new Date().toISOString() });
        if (error) throw error;
    },

    async getIntegrationSettings(service: string) {
        const supabase = getSupabase();
        if (!supabase) return null;
        const { data } = await supabase.from('integrations').select('settings').eq('service', service).single();
        return data?.settings || null;
    },

    // ----------------------------
    // TEAMLEADER AUTHENTICATION
    // ----------------------------

    async exchangeAuthCode(code: string, redirectUriOverride?: string) {
        const settings = await this.getIntegrationSettings('teamleader');
        if (!settings || !settings.client_id || !settings.client_secret) {
            throw new Error("Missing Client ID/Secret in database settings.");
        }
        
        const uriToUse = redirectUriOverride || settings.redirect_uri;
        if (!uriToUse) throw new Error("Missing Redirect URI.");

        // Send to PHP Proxy with 'exchange' action
        return await invokeEdgeFunction({
            action: 'exchange',
            client_id: settings.client_id,
            client_secret: settings.client_secret,
            code: code,
            redirect_uri: uriToUse
        });
    },

    async getTeamleaderUser(overrideToken?: string) {
        // If overriding, we just use the request action
        if (overrideToken) {
             const data = await invokeEdgeFunction({
                action: 'request',
                url: 'https://api.focus.teamleader.eu/users.me',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${overrideToken}`,
                    'Content-Type': 'application/json'
                }
             });
             return data.data;
        }

        // Default: Use authenticated wrapper
        const res = await this.teamleaderRequest('users.me', 'GET');
        return res.data;
    },

    async refreshAccessToken(settings: any) {
        if (!settings?.refresh_token) throw new Error("No refresh token");

        console.log("[API] Refreshing Token via PHP Proxy...");

        try {
            // Send to PHP Proxy with 'refresh' action
            const tokens = await invokeEdgeFunction({
                action: 'refresh',
                client_id: settings.client_id,
                client_secret: settings.client_secret,
                refresh_token: settings.refresh_token
            });

            if (!tokens || !tokens.access_token) {
                 console.error("Refresh response missing access_token", tokens);
                 return null;
            }

            const newSettings = {
                ...settings,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token, // Teamleader rotates refresh tokens!
                expires_in: tokens.expires_in,
                token_updated_at: new Date().toISOString()
            };

            await this.saveIntegrationSettings('teamleader', newSettings);
            console.log("Token refreshed and saved successfully.");
            return newSettings;
        } catch (e: any) {
            console.error("Refresh failed", e);
            if (e.status === 400 || (e.message && (e.message.includes('invalid_grant') || e.message.includes('invalid_request')))) {
                 console.warn("Refresh token invalid. Clearing credentials.");
                 await this.saveIntegrationSettings('teamleader', { ...settings, access_token: null, refresh_token: null });
            }
            return null;
        }
    },

    async teamleaderRequest(endpoint: string, method: 'GET' | 'POST', body: any = null) {
        let settings = await this.getIntegrationSettings('teamleader');
        if (!settings || !settings.access_token) {
            throw new Error("Teamleader not connected.");
        }

        const baseUrl = 'https://api.focus.teamleader.eu';
        const url = `${baseUrl}/${endpoint.replace(/^\//, '')}`;
        
        // Convert body for the request
        const payloadBody = body ? JSON.stringify(body) : undefined;

        try {
            return await invokeEdgeFunction({
                action: 'request',
                url: url,
                method: method,
                body: payloadBody,
                headers: {
                    'Authorization': `Bearer ${settings.access_token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (e: any) {
            // Handle 401 and Auto-Refresh
            if (e.status === 401 || (e.message && e.message.includes('401'))) {
                console.log("Teamleader 401. Refreshing...");
                const newSettings = await this.refreshAccessToken(settings);
                if (newSettings && newSettings.access_token) {
                    console.log("Retrying request...");
                    return await invokeEdgeFunction({
                        action: 'request',
                        url: url,
                        method: method,
                        body: payloadBody,
                        headers: {
                            'Authorization': `Bearer ${newSettings.access_token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                } else {
                    throw new Error("Session expired. Please reconnect Teamleader in Settings.");
                }
            }
            throw e;
        }
    },

    async syncToTeamleader(product: Product, description: string) {
        const isUpdate = !!product.teamleaderId;
        const b2bPriceObj = product.prices.find(p => p.priceList === PriceList.B2B);
        const consumerPriceObj = product.prices.find(p => p.priceList === PriceList.CONSUMER);
        const b2bAmount = b2bPriceObj ? b2bPriceObj.finalPrice : 0;
        const consumerAmount = consumerPriceObj ? consumerPriceObj.finalPrice : 0;

        const payload: any = {
            name: product.name,
            code: product.sku,
            description: description,
            selling_price: { amount: consumerAmount, currency: "EUR" },
            purchase_price: { amount: product.purchaseCost || 0, currency: "EUR" },
            price_list_prices: [
                {
                    price_list_id: "c78a8211-8aea-0025-b951-788b54f26e92",
                    price: { amount: b2bAmount, currency: "EUR" }
                }
            ]
        };

        if (isUpdate) payload.id = product.teamleaderId;
        const endpoint = isUpdate ? 'products.update' : 'products.add'; 
        
        const res = await this.teamleaderRequest(endpoint, 'POST', payload);
        return res?.data?.id || res?.id;
    },

    // ----------------------------
    // LOGGING
    // ----------------------------
    async fetchLogs(limit = 100): Promise<LogEntry[]> {
        const supabase = getSupabase();
        if (!supabase) return [];
        const { data, error } = await supabase.from('app_logs').select('*').order('created_at', { ascending: false }).limit(limit);
        if (error) return [];
        return data.map((d: any) => ({ id: d.id, type: d.type as LogType, message: d.message, details: d.details, userId: d.user_id, userName: d.user_name, createdAt: d.created_at }));
    },

    async logActivity(type: LogType, message: string, details?: any, user?: User | null) {
        const supabase = getSupabase();
        if (!supabase) return;
        supabase.from('app_logs').insert({ type, message, details, user_id: user?.id, user_name: user?.name });
    }
};
