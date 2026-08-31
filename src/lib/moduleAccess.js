import { supabase } from './supabase';

export const MODULES = {
  PHONE: 'PHONE_TRACKING',
  TRUCK: 'TRUCK_TRACKING',
  SHIP: 'SHIP_TRACKING'
};

export const SECTION_MODULE = {
  'PHONE TRACKING': MODULES.PHONE,
  'FLEET': MODULES.TRUCK,
  'SHIP TRACKING': MODULES.SHIP
};

export async function loadModuleAccess(userId) {
  if (!userId || !supabase) {
    return {
      company: null,
      modules: [],
      moduleCodes: [],
      error: new Error('Authentication is required to determine module access.')
    };
  }

  /*
   * PLATFORM ADMIN / OWNER BYPASS
   *
   * JABS Tracker owners and platform administrators are not customers.
   * They must be able to inspect every module regardless of a customer's
   * subscription configuration.
   *
   * Customer accounts remain subscription-controlled below.
   */
  const profileResult = await supabase
    .from('profiles')
    .select('id, company_id, account_type, role')
    .eq('id', userId)
    .maybeSingle();

  if (profileResult.error) {
    return {
      company: null,
      modules: [],
      moduleCodes: [],
      error: profileResult.error
    };
  }

  const profile = profileResult.data;

  const accountType =
    String(profile?.account_type || '').trim().toUpperCase();

  const role =
    String(profile?.role || '').trim().toUpperCase();

  const isPlatformAdmin =
    [
      'ADMIN',
      'OWNER',
      'SUPER_ADMIN',
      'PLATFORM_ADMIN',
      'JABS_ADMIN',
      'JABS_OWNER'
    ].includes(accountType) ||
    [
      'ADMIN',
      'OWNER',
      'SUPER_ADMIN',
      'PLATFORM_ADMIN',
      'JABS_ADMIN',
      'JABS_OWNER'
    ].includes(role);

  if (isPlatformAdmin) {
    const companyResult = profile?.company_id
      ? await supabase
          .from('companies')
          .select('id, name, slug, active')
          .eq('id', profile.company_id)
          .maybeSingle()
      : { data: null, error: null };

    if (companyResult.error) {
      return {
        company: null,
        modules: [],
        moduleCodes: [],
        error: companyResult.error
      };
    }

    const allModules = await supabase
      .from('modules')
      .select(`
        id,
        code,
        name,
        description,
        active
      `)
      .eq('active', true);

    if (allModules.error) {
      return {
        company: companyResult.data || null,
        modules: [],
        moduleCodes: [],
        error: allModules.error
      };
    }

    return {
      company: companyResult.data || null,
      modules: allModules.data || [],
      moduleCodes: (allModules.data || []).map(module => module.code),
      error: null
    };
  }

  /*
   * CUSTOMER SUBSCRIPTION ACCESS
   *
   * Customers only receive modules explicitly enabled for their
   * organization and currently within their subscription period.
   */
  const membership = await supabase
    .from('company_members')
    .select(`
      company_id,
      role,
      active,
      companies (
        id,
        name,
        slug,
        active
      )
    `)
    .eq('user_id', userId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (membership.error) {
    return {
      company: null,
      modules: [],
      moduleCodes: [],
      error: membership.error
    };
  }

  if (!membership.data?.company_id) {
    return {
      company: null,
      modules: [],
      moduleCodes: [],
      error: null
    };
  }

  const company = membership.data.companies;

  if (!company?.active) {
    return {
      company,
      modules: [],
      moduleCodes: [],
      error: new Error('This organization is inactive.')
    };
  }

  const result = await supabase
    .from('company_modules')
    .select(`
      enabled,
      starts_at,
      expires_at,
      modules (
        id,
        code,
        name,
        description,
        active
      )
    `)
    .eq('company_id', membership.data.company_id)
    .eq('enabled', true);

  if (result.error) {
    return {
      company,
      modules: [],
      moduleCodes: [],
      error: result.error
    };
  }

  const now = Date.now();

  const modules = (result.data || [])
    .filter(row => {
      const module = row.modules;

      if (!module?.active) return false;

      const starts = row.starts_at
        ? new Date(row.starts_at).getTime()
        : 0;

      const expires = row.expires_at
        ? new Date(row.expires_at).getTime()
        : Infinity;

      return now >= starts && now <= expires;
    })
    .map(row => row.modules);

  return {
    company,
    modules,
    moduleCodes: modules.map(module => module.code),
    error: null
  };
}
export function hasModule(moduleCodes, code) {
  return Array.isArray(moduleCodes) && moduleCodes.includes(code);
}

export function sectionAllowed(section, moduleCodes) {
  const required = SECTION_MODULE[section];

  if (!required) return true;

  return hasModule(moduleCodes, required);
}
