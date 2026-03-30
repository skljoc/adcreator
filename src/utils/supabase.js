import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wpgfesrmcleyqihexjhu.supabase.co'
const supabaseAnonKey = 'sb_publishable_zY94qtcvRoGWxEmj6tTJ0Q_-Ono3uxM'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
