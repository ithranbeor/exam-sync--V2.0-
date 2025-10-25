# api/admin.py
from django.contrib import admin
from .models import TblUsers, TblUserRole

admin.site.register(TblUsers)
admin.site.register(TblUserRole)
