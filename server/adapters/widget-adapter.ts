import { eq, and, sql, count, inArray, desc } from 'drizzle-orm';
import { db } from '../postgresql';
import {
  Widget,
  InsertWidget,
  WidgetUser,
  InsertWidgetUser,
  WidgetSession,
  InsertWidgetSession,
  AnonymousWidgetUser,
  InsertAnonymousWidgetUser,
  AnonymousWidgetSession,
  InsertAnonymousWidgetSession,
  WidgetLead,
  InsertWidgetLead
} from '../../shared/schema';
import { 
  widgets,
  widgetUsers,
  widgetSessions,
  anonymousWidgetUsers,
  anonymousWidgetSessions,
  widgetLeads
} from '../../shared/schema';

export class WidgetAdapter {
  async getWidget(id: string): Promise<Widget | undefined> {
    const results = await db
      .select()
      .from(widgets)
      .where(eq(widgets.id, id))
      .limit(1);
    
    return results[0];
  }

  async getWidgetsByUserId(userId: number): Promise<Widget[]> {
    return db
      .select()
      .from(widgets)
      .where(eq(widgets.userId, userId.toString()));
  }

  async getWidgetByPublicKey(publicKey: string): Promise<Widget | undefined> {
    const results = await db
      .select()
      .from(widgets)
      .where(eq(widgets.publicKey, publicKey))
      .limit(1);
    
    return results[0];
  }

  async createWidget(widget: InsertWidget): Promise<Widget> {
    const { nanoid } = await import('nanoid');
    
    // Validate and normalize position and size values
    const validPositions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const;
    const validSizes = ['small', 'medium', 'large'] as const;
    
    const normalizedPosition = validPositions.includes(widget.config.position as any) 
      ? widget.config.position as typeof validPositions[number]
      : 'bottom-right';
    
    const normalizedSize = validSizes.includes(widget.config.size as any)
      ? widget.config.size as typeof validSizes[number] 
      : 'medium';
    
    const normalizedConfig = {
      ...widget.config,
      position: normalizedPosition,
      size: normalizedSize
    };
    
    const widgetWithDefaults = {
      ...widget,
      config: normalizedConfig,
      id: nanoid(),
      secretKey: `sk_${nanoid(32)}`,
      publicKey: `pk_${nanoid(32)}`
    };
    
    const results = await db
      .insert(widgets)
      .values([widgetWithDefaults])
      .returning();
    
    return results[0];
  }

  async updateWidget(id: string, widgetData: Partial<Widget>): Promise<Widget | undefined> {
    const results = await db
      .update(widgets)
      .set(widgetData)
      .where(eq(widgets.id, id))
      .returning();
    
    return results[0];
  }

  async deleteWidget(id: string): Promise<boolean> {
    const result = await db
      .delete(widgets)
      .where(eq(widgets.id, id));
    
    return result.length > 0;
  }

  async getWidgetUser(id: number): Promise<WidgetUser | undefined> {
    const results = await db
      .select()
      .from(widgetUsers)
      .where(eq(widgetUsers.id, id))
      .limit(1);
    
    return results[0];
  }

  async getWidgetUserByWidgetAndEmail(widgetId: string, email: string): Promise<WidgetUser | undefined> {
    const results = await db
      .select()
      .from(widgetUsers)
      .where(
        and(
          eq(widgetUsers.widgetId, widgetId),
          eq(widgetUsers.email, email)
        )
      )
      .limit(1);
    
    return results[0];
  }

  async createWidgetUser(user: InsertWidgetUser): Promise<WidgetUser> {
    const results = await db
      .insert(widgetUsers)
      .values(user)
      .returning();
    
    return results[0];
  }

  async updateWidgetUser(id: number, userData: Partial<WidgetUser>): Promise<WidgetUser | undefined> {
    const results = await db
      .update(widgetUsers)
      .set(userData)
      .where(eq(widgetUsers.id, id))
      .returning();
    
    return results[0];
  }

  async getWidgetSession(id: string): Promise<WidgetSession | undefined> {
    const results = await db
      .select()
      .from(widgetSessions)
      .where(eq(widgetSessions.token, id))
      .limit(1);
    
    return results[0];
  }

  async createWidgetSession(session: InsertWidgetSession): Promise<WidgetSession> {
    const results = await db
      .insert(widgetSessions)
      .values([session])
      .returning();
    
    return results[0];
  }

  async updateWidgetSession(id: string, sessionData: Partial<WidgetSession>): Promise<WidgetSession | undefined> {
    const results = await db
      .update(widgetSessions)
      .set(sessionData)
      .where(eq(widgetSessions.token, id))
      .returning();
    
    return results[0];
  }

  async getAnonymousWidgetUser(id: number): Promise<AnonymousWidgetUser | undefined> {
    const results = await db
      .select()
      .from(anonymousWidgetUsers)
      .where(eq(anonymousWidgetUsers.id, id))
      .limit(1);
    
    return results[0];
  }

  async createAnonymousWidgetUser(user: InsertAnonymousWidgetUser): Promise<AnonymousWidgetUser> {
    const results = await db
      .insert(anonymousWidgetUsers)
      .values(user)
      .returning();
    
    return results[0];
  }

  async getAnonymousWidgetSession(id: string): Promise<AnonymousWidgetSession | undefined> {
    const results = await db
      .select()
      .from(anonymousWidgetSessions)
      .where(eq(anonymousWidgetSessions.uuid, id))
      .limit(1);
    
    return results[0];
  }

  async createAnonymousWidgetSession(session: InsertAnonymousWidgetSession): Promise<AnonymousWidgetSession> {
    const results = await db
      .insert(anonymousWidgetSessions)
      .values([session])
      .returning();
    
    return results[0];
  }

  async updateAnonymousWidgetSession(id: string, sessionData: Partial<AnonymousWidgetSession>): Promise<AnonymousWidgetSession | undefined> {
    const results = await db
      .update(anonymousWidgetSessions)
      .set(sessionData)
      .where(eq(anonymousWidgetSessions.uuid, id))
      .returning();
    
    return results[0];
  }

  async getWidgetLeadsByWidgetId(widgetId: string): Promise<WidgetLead[]> {
    return db
      .select()
      .from(widgetLeads)
      .where(eq(widgetLeads.widgetId, widgetId))
      .orderBy(desc(widgetLeads.createdAt));
  }

  async createWidgetLead(lead: InsertWidgetLead): Promise<WidgetLead> {
    const results = await db
      .insert(widgetLeads)
      .values([lead as any])
      .returning();
    
    return results[0];
  }

  async getWidgetLead(id: number): Promise<WidgetLead | undefined> {
    const results = await db
      .select()
      .from(widgetLeads)
      .where(eq(widgetLeads.id, id))
      .limit(1);
    
    return results[0];
  }

  async updateWidgetLead(id: number, leadData: Partial<WidgetLead>): Promise<WidgetLead | undefined> {
    const results = await db
      .update(widgetLeads)
      .set({
        ...leadData,
        updatedAt: new Date()
      })
      .where(eq(widgetLeads.id, id))
      .returning();
    
    return results[0];
  }

  async deleteWidgetLead(id: number): Promise<boolean> {
    const result = await db
      .delete(widgetLeads)
      .where(eq(widgetLeads.id, id));
    
    return result.length > 0;
  }
}