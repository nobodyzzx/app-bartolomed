import { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';

const makeRes = () => ({ cookie: jest.fn(), clearCookie: jest.fn() }) as unknown as jest.Mocked<Response>;

const makeReq = (cookieHeader = '') => ({ headers: { cookie: cookieHeader } }) as any;

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    authService = {
      create: jest.fn().mockResolvedValue({ id: 'user-1' }),
      login: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn().mockResolvedValue(undefined),
      checkAuthStatus: jest.fn().mockResolvedValue({ user: {}, token: 'jwt' }),
      getMyMemberships: jest.fn().mockResolvedValue([]),
      getProfile: jest.fn().mockResolvedValue({ id: 'user-1' }),
      updateProfile: jest.fn().mockResolvedValue({ id: 'user-1' }),
      changePassword: jest.fn().mockResolvedValue({ ok: true }),
      requestPasswordReset: jest.fn().mockResolvedValue({ ok: true }),
      resetPassword: jest.fn().mockResolvedValue({ ok: true }),
      bootstrapSuperAdmin: jest.fn(),
      syncSuperAdminMemberships: jest.fn().mockResolvedValue({ synced: 2 }),
    } as unknown as jest.Mocked<AuthService>;
    controller = new AuthController(authService);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('createUser delega el dto en authService.create()', async () => {
    const dto = { email: 'a@b.com' } as any;
    await controller.createUser(dto);
    expect(authService.create).toHaveBeenCalledWith(dto);
  });

  describe('loginUser', () => {
    it('setea cookies rt/rtr con maxAge de 15 días si rememberMe=true', async () => {
      authService.login.mockResolvedValue({
        user: { id: 'user-1' },
        token: 'jwt',
        refreshToken: 'refresh-token',
      } as any);
      const res = makeRes();

      const result = await controller.loginUser({ email: 'a@b.com', password: 'x', rememberMe: true } as any, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'rt',
        'refresh-token',
        expect.objectContaining({ httpOnly: true, maxAge: 15 * 24 * 60 * 60 * 1000 }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'rtr',
        '1',
        expect.objectContaining({ maxAge: 15 * 24 * 60 * 60 * 1000 }),
      );
      expect(result).toEqual({ user: { id: 'user-1' }, token: 'jwt', rememberMe: true });
    });

    it('setea cookies de sesión sin maxAge si rememberMe=false', async () => {
      authService.login.mockResolvedValue({ user: {}, token: 'jwt', refreshToken: 'refresh-token' } as any);
      const res = makeRes();

      await controller.loginUser({ email: 'a@b.com', password: 'x', rememberMe: false } as any, res);

      const [, , rtOptions] = (res.cookie as jest.Mock).mock.calls[0];
      expect(rtOptions.maxAge).toBeUndefined();
      expect(res.cookie).toHaveBeenCalledWith('rtr', '0', expect.not.objectContaining({ maxAge: expect.anything() }));
    });

    it('no setea cookies si el login no devuelve refreshToken', async () => {
      authService.login.mockResolvedValue({ user: {}, token: 'jwt' } as any);
      const res = makeRes();

      await controller.loginUser({ email: 'a@b.com', password: 'x' } as any, res);

      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('usa secure:true en producción', async () => {
      process.env.NODE_ENV = 'production';
      authService.login.mockResolvedValue({ user: {}, token: 'jwt', refreshToken: 'rt-1' } as any);
      const res = makeRes();

      await controller.loginUser({ email: 'a@b.com', password: 'x' } as any, res);

      expect(res.cookie).toHaveBeenCalledWith('rt', 'rt-1', expect.objectContaining({ secure: true }));
    });
  });

  describe('refresh', () => {
    it('usa el refreshToken del body si viene', async () => {
      authService.refreshToken.mockResolvedValue({ user: {}, token: 'jwt2' } as any);
      const res = makeRes();

      await controller.refresh({ refreshToken: 'body-token' } as any, makeReq(), res);

      expect(authService.refreshToken).toHaveBeenCalledWith({ refreshToken: 'body-token' });
    });

    it('cae a la cookie "rt" si el body no trae refreshToken', async () => {
      authService.refreshToken.mockResolvedValue({ user: {}, token: 'jwt2' } as any);
      const res = makeRes();

      await controller.refresh({} as any, makeReq('rt=cookie-token; rtr=1'), res);

      expect(authService.refreshToken).toHaveBeenCalledWith({ refreshToken: 'cookie-token' });
    });

    it('usa undefined si no hay body ni cookie', async () => {
      authService.refreshToken.mockResolvedValue({ user: {}, token: 'jwt2' } as any);
      const res = makeRes();

      await controller.refresh({} as any, makeReq(), res);

      expect(authService.refreshToken).toHaveBeenCalledWith({ refreshToken: undefined });
    });

    it('renueva las cookies con maxAge si rtr=1 en la request', async () => {
      authService.refreshToken.mockResolvedValue({ user: {}, token: 'jwt2', refreshToken: 'new-rt' } as any);
      const res = makeRes();

      const result = await controller.refresh({} as any, makeReq('rt=old; rtr=1'), res);

      expect(res.cookie).toHaveBeenCalledWith(
        'rt',
        'new-rt',
        expect.objectContaining({ maxAge: 15 * 24 * 60 * 60 * 1000 }),
      );
      expect(result).toEqual({ user: {}, token: 'jwt2', rememberMe: true });
    });

    it('trata rememberMe como false si no hay cookie rtr', async () => {
      authService.refreshToken.mockResolvedValue({ user: {}, token: 'jwt2', refreshToken: 'new-rt' } as any);
      const res = makeRes();

      const result = await controller.refresh({} as any, makeReq('rt=old'), res);

      expect(result.rememberMe).toBe(false);
    });

    it('devuelve rememberMe:false sin tocar cookies si no hay nuevo refreshToken', async () => {
      authService.refreshToken.mockResolvedValue({ user: {}, token: 'jwt2' } as any);
      const res = makeRes();

      const result = await controller.refresh({} as any, makeReq(), res);

      expect(res.cookie).not.toHaveBeenCalled();
      expect(result).toEqual({ user: {}, token: 'jwt2', rememberMe: false });
    });
  });

  it('logout invalida el refresh token del usuario y limpia la cookie rt', async () => {
    const res = makeRes();
    const user = { id: 'user-1' } as User;

    const result = await controller.logout(user, res);

    expect(authService.logout).toHaveBeenCalledWith('user-1');
    expect(res.clearCookie).toHaveBeenCalledWith('rt', expect.objectContaining({ httpOnly: true, path: '/' }));
    expect(result).toEqual({ ok: true });
  });

  it('checkStatus delega el user', async () => {
    const user = { id: 'user-1' } as User;
    await controller.checkStatus(user);
    expect(authService.checkAuthStatus).toHaveBeenCalledWith(user);
  });

  it('getMyMemberships delega userId y roles', async () => {
    const user = { id: 'user-1', roles: ['ADMIN'] } as unknown as User;
    await controller.getMyMemberships(user);
    expect(authService.getMyMemberships).toHaveBeenCalledWith('user-1', ['ADMIN']);
  });

  it('getProfile delega el user', async () => {
    const user = { id: 'user-1' } as User;
    await controller.getProfile(user);
    expect(authService.getProfile).toHaveBeenCalledWith(user);
  });

  it('updateProfile delega user y dto', async () => {
    const user = { id: 'user-1' } as User;
    const dto = { phone: '123' } as any;
    await controller.updateProfile(user, dto);
    expect(authService.updateProfile).toHaveBeenCalledWith(user, dto);
  });

  it('changePassword delega user y dto', async () => {
    const user = { id: 'user-1' } as User;
    const dto = { oldPassword: 'a', newPassword: 'b' } as any;
    await controller.changePassword(user, dto);
    expect(authService.changePassword).toHaveBeenCalledWith(user, dto);
  });

  it('requestPasswordReset delega el dto', async () => {
    const dto = { email: 'a@b.com' } as any;
    await controller.requestPasswordReset(dto);
    expect(authService.requestPasswordReset).toHaveBeenCalledWith(dto);
  });

  it('resetPassword delega el dto', async () => {
    const dto = { token: 'x', newPassword: 'y' } as any;
    await controller.resetPassword(dto);
    expect(authService.resetPassword).toHaveBeenCalledWith(dto);
  });

  describe('godmodeBootstrap', () => {
    it('prioriza el header x-god-token sobre el Bearer', async () => {
      authService.bootstrapSuperAdmin.mockResolvedValue({ user: {}, token: 'jwt', refreshToken: 'rt' } as any);
      const dto = { email: 'god@example.com' } as any;

      await controller.godmodeBootstrap(dto, 'god-token-header', 'Bearer bearer-token');

      expect(authService.bootstrapSuperAdmin).toHaveBeenCalledWith(dto, 'god-token-header');
    });

    it('cae al Bearer del header authorization si no hay x-god-token', async () => {
      authService.bootstrapSuperAdmin.mockResolvedValue({ user: {}, token: 'jwt' } as any);
      const dto = { email: 'god@example.com' } as any;

      await controller.godmodeBootstrap(dto, undefined, 'Bearer bearer-token');

      expect(authService.bootstrapSuperAdmin).toHaveBeenCalledWith(dto, 'bearer-token');
    });

    it('pasa undefined si no hay ningún token y no expone el refreshToken en la respuesta', async () => {
      authService.bootstrapSuperAdmin.mockResolvedValue({
        user: { id: 'u1' },
        token: 'jwt',
        refreshToken: 'secret',
      } as any);
      const dto = { email: 'god@example.com' } as any;

      const result = await controller.godmodeBootstrap(dto, undefined, undefined);

      expect(authService.bootstrapSuperAdmin).toHaveBeenCalledWith(dto, undefined);
      expect(result).toEqual({ user: { id: 'u1' }, token: 'jwt' });
    });
  });

  it('godmodeSyncSuperAdmins delega el header x-god-token', async () => {
    const result = await controller.godmodeSyncSuperAdmins('god-token');
    expect(authService.syncSuperAdminMemberships).toHaveBeenCalledWith('god-token');
    expect(result).toEqual({ synced: 2 });
  });
});
