'use strict';

const config = require('config');
const koa = require('koa');
const koaBody = require('koa-body')();
const koaLogger = require('koa-logger')();
const koaRouter = require('koa-router')();
const koaStatic = require('koa-static');
const koaViews = require('koa-views');
const app = new koa();

koaRouter.get('/', async (ctx, next) => {
	ctx.status = 200;
});

app.use(async (ctx, next) => {
	try {
		await next();
	} catch (error) {
		ctx.status = error.status || 500;
		ctx.body = {
			message: error.message
		};
	}
});

app.use(koaLogger);
app.use(koaStatic(__dirname + '/public'));
app.use(koaViews(__dirname + '/views', { extension: 'pug' }));
app.use(koaRouter.routes());

app.listen(process.env.PORT || config.port);